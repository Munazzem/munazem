import { StudentModel }            from '../../database/models/student.model.js';
import { GroupModel }              from '../../database/models/group.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel }        from '../../database/models/transaction.model.js';
import { MonthlyLedgerModel }      from '../../database/models/ledger.model.js';
import { SessionModel }            from '../../database/models/session.model.js';
import { TransactionType, TransactionCategory, SessionStatus } from '../../common/enums/enum.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';

export class ReportsService {

    // ══════════════════════════════════════════════════════════════
    // 1. Student Report — full picture of one student
    // ══════════════════════════════════════════════════════════════
    static async getStudentReport(studentId: string, teacherId: string) {
        const student = await StudentModel.findOne({ _id: studentId, teacherId }, {
            studentName: 1, parentName: 1, studentPhone: 1,
            gradeLevel:  1, groupId: 1, isActive: 1,
        }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        // Get group name
        const group = await GroupModel.findById(student.groupId, { name: 1 }).lean();

        // Attendance: search all snapshots for sessions where this student appears
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': student._id },
                { 'absentStudents.studentId':  student._id },
                { 'guestStudents.studentId':   student._id },
            ],
        }, {
            date: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1,
        }).sort({ date: -1 }).lean();

        let presentCount = 0;
        let absentCount  = 0;
        let lateCount    = 0;

        for (const snap of snapshots) {
            if (snap.presentStudents.some((s: any) => s.studentId.toString() === studentId)) presentCount++;
            else if (snap.absentStudents.some((s: any) => s.studentId.toString() === studentId)) absentCount++;
        }
        const totalSessions  = presentCount + absentCount;
        const attendanceRate = totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100)
            : 0;

        // Payment history — subscriptions + notebooks for this student
        const payments = await TransactionModel.find({
            teacherId,
            studentId:  student._id,
            type:       TransactionType.INCOME,
        }, {
            category: 1, paidAmount: 1, originalAmount: 1,
            discountAmount: 1, date: 1, description: 1,
        }).sort({ date: -1 }).lean();

        const totalPaid      = payments.reduce((sum, p) => sum + p.paidAmount, 0);
        const totalDiscount  = payments.reduce((sum, p) => sum + p.discountAmount, 0);
        const subscriptions  = payments.filter(p => p.category === TransactionCategory.SUBSCRIPTION);
        const notebookSales  = payments.filter(p => p.category === TransactionCategory.NOTEBOOK_SALE);

        return {
            student: {
                ...student,
                groupName: group?.name ?? '—',
            },
            attendance: {
                totalSessions,
                presentCount,
                absentCount,
                attendanceRate: `${attendanceRate}%`,
            },
            payments: {
                totalPaid,
                totalDiscount,
                subscriptionsCount:  subscriptions.length,
                notebookSalesCount:  notebookSales.length,
                history:             payments,
            },
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 2. Group Report — attendance + revenue for a group
    // ══════════════════════════════════════════════════════════════
    static async getGroupReport(groupId: string, teacherId: string) {
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });

        // Total students in group
        const totalStudents = await StudentModel.countDocuments({ groupId, teacherId, isActive: true });

        // All completed sessions for this group
        const sessions = await SessionModel.find({
            groupId, teacherId, status: SessionStatus.COMPLETED,
        }, { _id: 1, date: 1 }).lean();

        const sessionIds = sessions.map(s => s._id);

        // All snapshots for those sessions
        const snapshots = await AttendanceSnapshotModel.find(
            { sessionId: { $in: sessionIds } },
            { date: 1, presentCount: 1, absentCount: 1, totalCount: 1 }
        ).sort({ date: -1 }).lean();

        const totalSessions      = snapshots.length;
        const totalPresences     = snapshots.reduce((sum, s) => sum + s.presentCount, 0);
        const totalAbsences      = snapshots.reduce((sum, s) => sum + s.absentCount,  0);
        const avgAttendanceRate  = totalSessions > 0
            ? Math.round((totalPresences / (totalPresences + totalAbsences)) * 100)
            : 0;

        // Revenue: subscriptions from students in this group
        const students = await StudentModel.find(
            { groupId, teacherId },
            { _id: 1 }
        ).lean();
        const studentIds = students.map(s => s._id);

        const revenue = await TransactionModel.aggregate([
            {
                $match: {
                    teacherId: group.teacherId,
                    studentId: { $in: studentIds },
                    type:      TransactionType.INCOME,
                },
            },
            {
                $group: {
                    _id:          '$category',
                    total:        { $sum: '$paidAmount' },
                    count:        { $sum: 1 },
                    totalDiscount:{ $sum: '$discountAmount' },
                },
            },
        ]);

        return {
            group: {
                name:        group.name,
                gradeLevel:  group.gradeLevel,
                schedule:    group.schedule,
                totalStudents,
            },
            attendance: {
                totalSessions,
                avgAttendanceRate: `${avgAttendanceRate}%`,
                totalPresences,
                totalAbsences,
                sessionsHistory: snapshots,
            },
            revenue: {
                breakdown: revenue,
            },
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 3. Monthly Financial Report — income / expenses / net
    // ══════════════════════════════════════════════════════════════
    static async getFinancialMonthlyReport(teacherId: string, year: number, month: number) {
        // Use the pre-computed MonthlyLedger — zero aggregation cost
        const ledger = await MonthlyLedgerModel.findOne({ teacherId, year, month }).lean();

        if (!ledger) {
            return {
                year, month,
                totalIncome: 0, totalExpenses: 0, netBalance: 0,
                dailySummaries: [],
                breakdown: [],
            };
        }

        // Breakdown by category (from Transaction model)
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth   = new Date(Date.UTC(year, month, 1));

        const breakdown = await TransactionModel.aggregate([
            {
                $match: {
                    teacherId: ledger.teacherId,
                    date: { $gte: startOfMonth, $lt: endOfMonth },
                },
            },
            {
                $group: {
                    _id:   { type: '$type', category: '$category' },
                    total: { $sum: '$paidAmount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.type': 1, '_id.category': 1 } },
        ]);

        return {
            year,
            month,
            totalIncome:    ledger.totalIncome,
            totalExpenses:  ledger.totalExpenses,
            netBalance:     ledger.netBalance,
            dailySummaries: ledger.dailySummaries.sort(
                (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
            ),
            breakdown,
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 4. Dashboard Summary — quick stats for the teacher's home page
    // ══════════════════════════════════════════════════════════════
    static async getDashboardSummary(teacherId: string) {
        const now   = new Date();
        const year  = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));

        const [
            totalStudents,
            totalGroups,
            monthlyLedger,
            sessionsThisMonth,
        ] = await Promise.all([
            StudentModel.countDocuments({ teacherId, isActive: true }),
            GroupModel.countDocuments({ teacherId }),
            MonthlyLedgerModel.findOne({ teacherId, year, month }, {
                totalIncome: 1, totalExpenses: 1, netBalance: 1,
            }).lean(),
            SessionModel.countDocuments({
                teacherId,
                date:   { $gte: startOfMonth },
                status: SessionStatus.COMPLETED,
            }),
        ]);

        return {
            totalStudents,
            totalGroups,
            sessionsThisMonth,
            financial: {
                totalIncome:   monthlyLedger?.totalIncome   ?? 0,
                totalExpenses: monthlyLedger?.totalExpenses ?? 0,
                netBalance:    monthlyLedger?.netBalance    ?? 0,
            },
        };
    }
}
