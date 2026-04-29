import { ExamModel }       from '../../database/models/exam.model.js';
import { ExamResultModel } from '../../database/models/exam-result.model.js';
import { StudentModel }    from '../../database/models/student.model.js';
import { ExamStatus, ExamSource } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException, ConflictException } from '../../common/utils/response/error.responce.js';
import type { IQuestion }  from '../../types/exam.types.js';

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

    // ── Update exam (allowed only in DRAFT status) ───────────────────
    static async updateExam(examId: string, teacherId: string, data: Partial<{
        title: string; date: string; totalMarks: number;
        passingMarks: number; questions: IQuestion[]; gradeLevel: string; groupIds: string[];
    }>) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });
        if (exam.status !== ExamStatus.DRAFT) {
            throw BadRequestException({ message: 'لا يمكن تعديل امتحان منشور أو مكتمل' });
        }
        // Use findOneAndUpdate with teacherId — never trust just examId
        return await ExamModel.findOneAndUpdate(
            { _id: examId, teacherId },
            data,
            { new: true, runValidators: true }
        ).lean();
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

    // ── Record single student result ─────────────────────────────────
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

        // Scope student lookup to this teacher — prevent recording results for another teacher's student
        const student = await StudentModel.findOne(
            { _id: data.studentId, teacherId },
            { studentName: 1, groupId: 1 }
        ).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود أو لا ينتمي لك' });

        const percentage = Math.round((data.score / exam.totalMarks) * 100);
        const grade      = computeGrade(percentage);
        const passed     = data.score >= exam.passingMarks;

        try {
            return await ExamResultModel.create({
                examId:      exam._id,
                teacherId,
                studentId:   student._id,
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
            });
        } catch (err: any) {
            if (err.code === 11000) throw ConflictException({ message: 'تم تسجيل درجة هذا الطالب بالفعل' });
            throw err;
        }
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
            { studentName: 1, groupId: 1 }
        ).lean();

        const studentMap = new Map(students.map(s => [s._id.toString(), s]));

        const docs = data.results.map(r => {
            const student = studentMap.get(r.studentId);
            if (!student) return null;
            const score      = Math.min(r.score, exam.totalMarks);
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

        const result = await ExamResultModel.insertMany(docs, { ordered: false });
        return { total: data.results.length, inserted: result.length };
    }

    // ── Get results for an exam ──────────────────────────────────────
    static async getExamResults(examId: string, teacherId: string) {
        const exam = await ExamModel.findOne({ _id: examId, teacherId }).lean();
        if (!exam) throw NotFoundException({ message: 'الامتحان غير موجود' });

        const results = await ExamResultModel.find({ examId, teacherId }).sort({ studentName: 1 }).lean();
        const passing = results.filter(r => r.passed).length;

        return {
            exam:         { title: exam.title, date: exam.date, totalMarks: exam.totalMarks },
            totalStudents: results.length,
            passingCount:  passing,
            failingCount:  results.length - passing,
            passRate:      results.length > 0 ? `${Math.round((passing / results.length) * 100)}%` : '0%',
            results,
        };
    }

    // ── Get student exam history (for student report) ─────────────────
    static async getStudentExamHistory(studentId: string, teacherId: string) {
        return await ExamResultModel.find({ studentId, teacherId })
            .sort({ date: -1 })
            .lean();
    }
}
