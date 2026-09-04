import { ExamModel }       from '../../database/models/exam.model.js';
import { ExamResultModel } from '../../database/models/exam-result.model.js';
import { StudentModel }    from '../../database/models/student.model.js';
import { UserModel }       from '../../database/models/user.model.js';
import { ExamStatus, ExamSource } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import { enqueueWhatsApp } from '../../infrastructure/queues/whatsapp.queue.js';
import type { IQuestion }  from '../../types/exam.types.js';
import { ParentPushService } from '../parent/parent-push.service.js';

// ── Grade letter calculator ───────────────────────────────────────
function computeGrade(percentage: number): string {
    if (percentage >= 95) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 75) return 'B';
    if (percentage >= 65) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

export class ExamsService {

    // ── Create exam manually ────────────────────────────────────────
    static async createExam(teacherId: string, data: {
        title: string;
        gradeLevel?: string;
        groupIds?: string[];
        date: string;
        totalMarks: number;
        passingMarks: number;
        questions?: IQuestion[];
        source?: ExamSource;
    }) {
        return await ExamModel.create({
            teacherId,
            title:       data.title,
            date:        new Date(data.date),
            totalMarks:  data.totalMarks,
            passingMarks: data.passingMarks,
            questions:   data.questions ?? [],
            status:      ExamStatus.DRAFT,
            source:      data.source ?? ExamSource.MANUAL,
            ...(data.gradeLevel ? { gradeLevel: data.gradeLevel } : {}),
            ...(data.groupIds?.length ? { groupIds: data.groupIds } : {}),
        });
    }

    // ── List exams for teacher ──────────────────────────────────────
    static async getExams(teacherId: string, query: any = {}) {
        const filter: any = { teacherId };
        if (query.status)     filter.status     = query.status;
        if (query.gradeLevel) filter.gradeLevel = query.gradeLevel;

        const page  = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, parseInt(query.limit) || 20);
        const skip  = (page - 1) * limit;

        const [data, total] = await Promise.all([
            ExamModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
            ExamModel.countDocuments(filter),
        ]);
        return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    // ── Get single exam ─────────────────────────────────────────────
    static async getExamById(examId: string, teacherId: string) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });
        return exam;
    }

    // ── Update exam (allowed in DRAFT, PUBLISHED, or COMPLETED) ─────
    static async updateExam(examId: string, teacherId: string, data: Partial<{
        title: string; date: string; totalMarks: number;
        passingMarks: number; questions: IQuestion[]; gradeLevel: string; groupIds: string[];
    }>) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        // If totalMarks is changed, verify it is not lower than any existing student score
        if (data.totalMarks !== undefined) {
            const maxScoreResult = await ExamResultModel.findOne({ examId, teacherId }).sort({ score: -1 }).lean();
            if (maxScoreResult && maxScoreResult.score > data.totalMarks) {
                throw BadRequestException({
                    message: `لا يمكن تقليل الدرجة الكلية عن أعلى درجة حصل عليها الطلاب (${maxScoreResult.score})`,
                });
            }
        }

        // Use findOneAndUpdate with teacherId — never trust just examId
        const updatedExam = await ExamModel.findOneAndUpdate(
            { _id: examId, teacherId },
            data,
            { new: true, runValidators: true }
        ).lean();

        if (!updatedExam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        // Cascade updates to all existing ExamResultModel records if totalMarks, passingMarks, or date changed
        if (data.totalMarks !== undefined || data.passingMarks !== undefined || data.date !== undefined) {
            const results = await ExamResultModel.find({ examId, teacherId });
            if (results.length > 0) {
                const newTotal = updatedExam.totalMarks;
                const newPassing = updatedExam.passingMarks;
                const newDate = updatedExam.date;

                const bulkOps = results.map(r => {
                    const percentage = Math.round((r.score / newTotal) * 100);
                    const grade = computeGrade(percentage);
                    const passed = r.score >= newPassing;
                    return {
                        updateOne: {
                            filter: { _id: r._id },
                            update: {
                                $set: {
                                    totalMarks: newTotal,
                                    passingMarks: newPassing,
                                    percentage,
                                    grade,
                                    passed,
                                    date: newDate,
                                }
                            }
                        }
                    };
                });
                await ExamResultModel.bulkWrite(bulkOps);
            }
        }

        return updatedExam;
    }

    // ── Publish exam ─────────────────────────────────────────────────
    static async publishExam(examId: string, teacherId: string) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });
        // Allow publishing even without questions
        return await ExamModel.findOneAndUpdate(
            { _id: examId, teacherId },
            { status: ExamStatus.PUBLISHED },
            { new: true }
        ).lean();
    }

    // ── Delete exam ───────────────────────────────────────────────────
    static async deleteExam(examId: string, teacherId: string) {
        const exam = await ExamModel.findOneAndDelete({ _id: examId, teacherId, status: ExamStatus.DRAFT }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود أو لا يمكن حذف امتحان منشور' });
        return exam;
    }

    // ── Record single student result (Insert or Update if already exists) ──
    static async recordResult(teacherId: string, recordedBy: string, data: {
        examId: string;
        studentId: string;
        score: number;
    }) {
        const exam = await ExamModel.findOne({ _id: data.examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });
        if (exam.status === ExamStatus.DRAFT) throw BadRequestException({ message: 'يجب نشر الامتحان أولاً' });

        if (data.score > exam.totalMarks) {
            throw BadRequestException({ message: `الدرجة لا يمكن أن تتجاوز ${exam.totalMarks}` });
        }
        if (data.score < 0) {
            throw BadRequestException({ message: 'الدرجة لا يمكن أن تكون سالبة' });
        }

        // Scope student lookup to this teacher — prevent recording results for another teacher's student
        const student = await StudentModel.findOne(
            { _id: data.studentId, teacherId },
            { studentName: 1, groupId: 1, parentPhone: 1 }
        ).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود أو لا ينتمي لك' });

        const percentage = Math.round((data.score / exam.totalMarks) * 100);
        const grade      = computeGrade(percentage);
        const passed     = data.score >= exam.passingMarks;

        const resultDoc = await ExamResultModel.findOneAndUpdate(
            { examId: exam._id, studentId: student._id },
            {
                $set: {
                    teacherId,
                    studentName: student.studentName,
                    groupId:     student.groupId,
                    score:       data.score,
                    totalMarks:  exam.totalMarks,
                    passingMarks: exam.passingMarks,
                    percentage,
                    grade,
                    passed,
                    recordedBy,
                    date:        exam.date,
                }
            },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        // ── Parent Push Notification (non-blocking) ─────────────────────────
        UserModel.findById(teacherId, { name: 1, subject: 1 }).lean().then((teacherDoc) => {
            const rawName   = (teacherDoc as any)?.name ?? '';
            const subject   = (teacherDoc as any)?.subject;
            const teacherName = subject ? `${rawName} (${subject})` : rawName;
            ParentPushService.notifyExamResult({
                studentId:   student._id.toString(),
                studentName: student.studentName,
                teacherId,
                teacherName,
                subject,
                examTitle:   exam.title,
                examId:      exam._id.toString(),
                score:       data.score,
                totalMarks:  exam.totalMarks,
                percentage,
                passed,
                grade,
                examDate:    exam.date,
            });
        }).catch(() => {/* ignore */});

        return resultDoc;
    }

    // ── Update single student result ──────────────────────────────────
    static async updateResult(teacherId: string, recordedBy: string, examId: string, resultId: string, score: number) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        if (score > exam.totalMarks) {
            throw BadRequestException({ message: `الدرجة لا يمكن أن تتجاوز ${exam.totalMarks}` });
        }
        if (score < 0) {
            throw BadRequestException({ message: 'الدرجة لا يمكن أن تكون سالبة' });
        }

        const percentage = Math.round((score / exam.totalMarks) * 100);
        const grade      = computeGrade(percentage);
        const passed     = score >= exam.passingMarks;

        const updated = await ExamResultModel.findOneAndUpdate(
            { _id: resultId, examId, teacherId },
            {
                $set: {
                    score,
                    totalMarks:   exam.totalMarks,
                    passingMarks: exam.passingMarks,
                    percentage,
                    grade,
                    passed,
                    recordedBy,
                }
            },
            { new: true }
        ).lean();

        if (!updated) throw NotFoundException({ message: 'النتيجة غير موجودة' });
        return updated;
    }

    // ── Delete single student result ──────────────────────────────────
    static async deleteResult(teacherId: string, examId: string, resultId: string) {
        const deleted = await ExamResultModel.findOneAndDelete({ _id: resultId, examId, teacherId }).lean();
        if (!deleted) throw NotFoundException({ message: 'النتيجة غير موجودة' });
        return deleted;
    }

    // ── Batch record results for multiple students ───────────────────
    static async batchRecordResults(teacherId: string, recordedBy: string, data: {
        examId: string;
        results: { studentId: string; score: number }[];
    }) {
        const exam = await ExamModel.findOne({ _id: data.examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });
        if (exam.status === ExamStatus.DRAFT) throw BadRequestException({ message: 'يجب نشر الامتحان أولاً' });

        const studentIds = data.results.map(r => r.studentId);
        // Scope to this teacher — prevents injecting another teacher's students
        const students   = await StudentModel.find(
            { _id: { $in: studentIds }, teacherId },
            { studentName: 1, groupId: 1, parentPhone: 1 }  // parentPhone for WhatsApp
        ).lean();

        const studentMap = new Map(students.map(s => [s._id.toString(), s]));

        const docs = data.results.map(r => {
            const student = studentMap.get(r.studentId);
            if (!student) return null;
            const score      = Math.min(Math.max(0, r.score), exam.totalMarks);
            const percentage = Math.round((score / exam.totalMarks) * 100);
            return {
                examId:      exam._id,
                teacherId,
                studentId:   student._id,
                studentName: student.studentName,
                groupId:     student.groupId,
                score,
                totalMarks:  exam.totalMarks,
                passingMarks: exam.passingMarks,
                percentage,
                grade:       computeGrade(percentage),
                passed:      score >= exam.passingMarks,
                recordedBy,
                date:        exam.date,
            };
        }).filter(Boolean);

        if (docs.length === 0) {
            return { total: data.results.length, inserted: 0 };
        }

        const bulkOps = docs.map((doc: any) => ({
            updateOne: {
                filter: { examId: doc.examId, studentId: doc.studentId },
                update: { $set: doc },
                upsert: true,
            }
        }));

        const bulkRes = await ExamResultModel.bulkWrite(bulkOps);
        const totalAffected = (bulkRes.upsertedCount || 0) + (bulkRes.modifiedCount || 0) + (bulkRes.matchedCount || 0);

        // ── Parent Push Notifications for batch (non-blocking) ───────────────────
        UserModel.findById(teacherId, { name: 1, subject: 1 }).lean().then((teacherDoc) => {
            const rawName    = (teacherDoc as any)?.name ?? '';
            const subject    = (teacherDoc as any)?.subject;
            const teacherName = subject ? `${rawName} (${subject})` : rawName;
            for (const doc of docs as any[]) {
                ParentPushService.notifyExamResult({
                    studentId:   doc.studentId.toString(),
                    studentName: doc.studentName,
                    teacherId,
                    teacherName,
                    subject,
                    examTitle:   exam.title,
                    examId:      exam._id.toString(),
                    score:       doc.score,
                    totalMarks:  doc.totalMarks,
                    percentage:  doc.percentage,
                    passed:      doc.passed,
                    grade:       doc.grade,
                    examDate:    exam.date,
                });
            }
        }).catch(() => {/* ignore */});
        return { total: data.results.length, inserted: totalAffected };
    }

    // ── Get results for an exam ──────────────────────────────────────
    static async getExamResults(examId: string, teacherId: string) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        const teacherDoc = await UserModel.findById(teacherId, { name: 1, subject: 1 }).lean().catch(() => null);
        const teacherName = (teacherDoc as any)?.name ?? '';
        const subject = (teacherDoc as any)?.subject ?? '';

        const results = await ExamResultModel.find({ examId, teacherId }).sort({ studentName: 1 }).lean();

        // Enrich with parentPhone for WhatsApp links
        const studentIds = results.map(r => r.studentId);
        const students = await StudentModel.find(
            { _id: { $in: studentIds } },
            { parentPhone: 1 }
        ).lean();
        const phoneMap = new Map(students.map(s => [s._id.toString(), (s as any).parentPhone]));

        const enrichedResults = results.map(r => ({
            ...r,
            parentPhone: phoneMap.get(r.studentId?.toString()) ?? null,
        }));

        const passing = results.filter(r => r.passed).length;

        return {
            exam:         { title: exam.title, date: exam.date, totalMarks: exam.totalMarks },
            teacherName,
            subject,
            totalStudents: results.length,
            passingCount:  passing,
            failingCount:  results.length - passing,
            passRate:      results.length > 0 ? `${Math.round((passing / results.length) * 100)}%` : '0%',
            results:       enrichedResults,
        };
    }

    // ── Get student exam history (for student report) ─────────────────
    static async getStudentExamHistory(studentId: string, teacherId: string) {
        return await ExamResultModel.find({ studentId, teacherId })
            .sort({ date: -1 })
            .lean();
    }

    // ── Send WhatsApp Messages for Exam Results ───────────────────────
    static async sendExamResultsWhatsApp(examId: string, teacherId: string) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        const results = await ExamResultModel.find({ examId, teacherId }).lean();
        if (results.length === 0) return { sentCount: 0 };

        const studentIds = results.map(r => r.studentId);
        const students = await StudentModel.find(
            { _id: { $in: studentIds } },
            { parentPhone: 1, studentName: 1 }
        ).lean();
        const studentMap = new Map(students.map(s => [s._id.toString(), s]));

        const teacherDoc = await UserModel.findById(teacherId, { name: 1, subject: 1 }).lean().catch(() => null);
        const rawTeacherName = (teacherDoc as any)?.name ?? '';
        const subject = (teacherDoc as any)?.subject;
        const teacherName = subject ? `${rawTeacherName} (${subject})` : rawTeacherName;

        let sentCount = 0;
        for (const r of results) {
            const student = studentMap.get(r.studentId?.toString());
            const parentPhone = (student as any)?.parentPhone as string | undefined;
            if (!parentPhone) continue;

            enqueueWhatsApp({
                kind:        'exam_result',
                teacherId,
                parentPhone,
                studentName: r.studentName,
                examTitle:   exam.title,
                score:       r.score,
                totalMarks:  r.totalMarks,
                percentage:  r.percentage,
                grade:       r.grade,
                passed:      r.passed,
                examDate:    exam.date.toISOString(),
                teacherName: rawTeacherName,
                subject:     subject || '',
            });
            sentCount++;
        }
        return { sentCount };
    }
}
