import { StudentModel }   from '../../database/models/student.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { ExamResultModel }  from '../../database/models/exam-result.model.js';
import { GroupModel }       from '../../database/models/group.model.js';
import { UserModel }        from '../../database/models/user.model.js';
import { TransactionType, TransactionCategory, AttendanceStatus } from '../../common/enums/enum.service.js';
import { NotFoundException, BadRequestException } from '../../common/utils/response/error.responce.js';

export class ParentService {

    static async lookupByPhone(parentPhone: string) {
        const phone = parentPhone.trim();
        if (!phone) throw BadRequestException({ message: 'رقم الهاتف مطلوب' });

        const students = await StudentModel.find(
            { parentPhone: phone },
            { studentName: 1, gradeLevel: 1, groupId: 1, teacherId: 1,
              studentCode: 1, isActive: 1, parentName: 1 }
        ).lean();

        if (!students.length) {
            throw NotFoundException({ message: 'لم يتم العثور على أي طالب مرتبط بهذا الرقم' });
        }

        const results = await Promise.all(students.map(student =>
            ParentService.buildStudentSummary(student)
        ));

        return results;
    }

    private static async buildStudentSummary(student: any) {
        const teacherId  = student.teacherId;
        const studentId  = student._id;

        // Group name and cycle
        const group = await GroupModel.findOne(
            { _id: student.groupId, teacherId },
            { name: 1, cycle: 1 }
        ).lean();

        // Teacher name & features
        const teacher = await UserModel.findById(teacherId, { name: 1, features: 1 }).lean();
        const isHomeworkEnabled = Boolean(teacher?.features?.homeworkTracking);

        // Attendance snapshots
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': studentId },
                { 'absentStudents.studentId':  studentId },
                { 'guestStudents.studentId':   studentId },
            ],
        }, { date: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1 })
            .sort({ date: -1 })
            .lean();

        // Map and deduplicate by date (priority: PRESENT/LATE (4) > GUEST (3) > EXCUSED (2) > ABSENT (1))
        const dayMap = new Map<string, { date: Date; status: string; homeworkDone?: boolean | null; priority: number }>();

        for (const snap of snapshots) {
            const sid = studentId.toString();
            const presentStudent = snap.presentStudents?.find((s: any) => s.studentId?.toString() === sid);
            const isAbsent  = snap.absentStudents?.some((s: any)  => s.studentId?.toString() === sid);
            const isGuest   = snap.guestStudents?.some((s: any)  => s.studentId?.toString() === sid);

            let status = 'UNKNOWN';
            let priority = 0;
            let homeworkDone: boolean | null = null;

            if (presentStudent) {
                const s = presentStudent.status || AttendanceStatus.PRESENT;
                if (s === AttendanceStatus.EXCUSED) {
                    status = 'EXCUSED';
                    priority = 2;
                } else {
                    status = s; // PRESENT / LATE
                    priority = 4;
                    homeworkDone = typeof presentStudent.homeworkDone === 'boolean' ? presentStudent.homeworkDone : null;
                }
            } else if (isGuest) {
                status = 'GUEST';
                priority = 3;
                const guestStudent = snap.guestStudents?.find((s: any) => s.studentId?.toString() === sid);
                homeworkDone = typeof guestStudent?.homeworkDone === 'boolean' ? guestStudent.homeworkDone : null;
            } else if (isAbsent) {
                status = 'ABSENT';
                priority = 1;
            }

            if (status !== 'UNKNOWN') {
                const dayKey = snap.date ? (new Date(snap.date).toISOString().split('T')[0] || 'unknown') : ((snap as any)._id?.toString() || 'unknown');
                const existing = dayMap.get(dayKey);
                if (!existing || priority > existing.priority) {
                    dayMap.set(dayKey, { date: snap.date, status, homeworkDone, priority });
                }
            }
        }

        const deduplicatedEntries = Array.from(dayMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const presentCount = deduplicatedEntries.filter(
            e => e.status === AttendanceStatus.PRESENT || e.status === AttendanceStatus.LATE || e.status === 'GUEST' || e.status === AttendanceStatus.EXCUSED
        ).length;
        const absentCount  = deduplicatedEntries.filter(e => e.status === AttendanceStatus.ABSENT).length;
        const attendanceHistory = deduplicatedEntries.slice(0, 20).map(e => ({
            date: e.date,
            status: e.status,
            homeworkDone: isHomeworkEnabled ? (e.homeworkDone ?? null) : null,
        }));

        const totalSessions  = presentCount + absentCount;
        const attendanceRate = totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100)
            : 0;

        // Payments (income only, linked to student)
        const payments = await TransactionModel.find(
            { teacherId, studentId, type: TransactionType.INCOME },
            { category: 1, paidAmount: 1, discountAmount: 1, date: 1, description: 1 }
        ).sort({ date: -1 }).lean();

        const totalPaid     = payments.reduce((sum, p) => sum + p.paidAmount, 0);
        const subscriptions = payments.filter(p => p.category === TransactionCategory.SUBSCRIPTION);

        // Active subscription for current cycle?
        const cycleStartedAt = (group as any)?.cycle?.startedAt ? new Date((group as any).cycle.startedAt) : new Date('2099-01-01');
        const hasActiveSubscription = subscriptions.some(
            s => new Date(s.date) >= cycleStartedAt
        );

        // Exam results
        const examResults = await ExamResultModel.find(
            { studentId, teacherId },
            { examId: 1, score: 1, totalMarks: 1, passingMarks: 1, date: 1, isPassed: 1 }
        ).populate('examId', 'title').sort({ date: -1 }).lean();

        return {
            studentId:   studentId.toString(),
            studentName: student.studentName,
            studentCode: student.studentCode,
            gradeLevel:  student.gradeLevel,
            groupName:   group?.name ?? '—',
            teacherName: teacher?.name ?? '—',
            isActive:    student.isActive,
            hasActiveSubscription,
            attendance: {
                totalSessions,
                presentCount,
                absentCount,
                attendanceRate: `${attendanceRate}%`,
                history: attendanceHistory,
            },
            payments: {
                totalPaid,
                subscriptionsCount: subscriptions.length,
                lastSubscriptions:  subscriptions.slice(0, 5),
            },
            exams: examResults.slice(0, 10).map((e: any) => ({
                examId: e.examId?._id?.toString() || e.examId?.toString(),
                examName: e.examId?.title ?? 'امتحان بدون عنوان',
                score: e.score,
                totalMarks: e.totalMarks,
                passingMarks: e.passingMarks,
                date: e.date,
                isPassed: e.isPassed
            })),
        };
    }
}
