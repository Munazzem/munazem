import { StudentModel }   from '../../database/models/student.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { ExamResultModel }  from '../../database/models/exam-result.model.js';
import { GroupModel }       from '../../database/models/group.model.js';
import { TransactionType, TransactionCategory } from '../../common/enums/enum.service.js';
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

        // Group name
        const group = await GroupModel.findOne(
            { _id: student.groupId, teacherId },
            { name: 1 }
        ).lean();

        // Attendance snapshots
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': studentId },
                { 'absentStudents.studentId':  studentId },
                { 'guestStudents.studentId':   studentId },
            ],
        }, { date: 1, presentStudents: 1, absentStudents: 1 })
            .sort({ date: -1 })
            .lean();

        let presentCount = 0;
        let absentCount  = 0;

        const attendanceHistory = snapshots.slice(0, 20).map((snap: any) => {
            const sid = studentId.toString();
            const isPresent = snap.presentStudents.some((s: any) => s.studentId.toString() === sid);
            const isAbsent  = snap.absentStudents.some((s: any)  => s.studentId.toString() === sid);
            const status    = isPresent ? 'PRESENT' : isAbsent ? 'ABSENT' : 'GUEST';
            if (isPresent) presentCount++;
            else if (isAbsent) absentCount++;
            return { date: snap.date, status };
        });

        // Count remaining snapshots beyond the history slice
        for (const snap of snapshots.slice(20)) {
            const sid = studentId.toString();
            if (snap.presentStudents.some((s: any) => s.studentId.toString() === sid)) presentCount++;
            else if (snap.absentStudents.some((s: any) => s.studentId.toString() === sid)) absentCount++;
        }

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

        // Active subscription this month?
        const now        = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const hasActiveSubscription = subscriptions.some(
            s => new Date(s.date) >= monthStart && new Date(s.date) < monthEnd
        );

        // Exam results
        const examResults = await ExamResultModel.find(
            { studentId, teacherId },
            { examId: 1, score: 1, totalMarks: 1, passingMarks: 1, date: 1, isPassed: 1 }
        ).sort({ date: -1 }).lean();

        return {
            studentId:   studentId.toString(),
            studentName: student.studentName,
            studentCode: student.studentCode,
            gradeLevel:  student.gradeLevel,
            groupName:   group?.name ?? '—',
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
            exams: examResults.slice(0, 10),
        };
    }
}
