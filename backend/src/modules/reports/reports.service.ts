import { StudentModel }            from '../../database/models/student.model.js';
import { GroupModel }              from '../../database/models/group.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel }        from '../../database/models/transaction.model.js';
import { SessionModel }            from '../../database/models/session.model.js';
import { DailyLedgerModel, MonthlyLedgerModel } from '../../database/models/ledger.model.js';
import mongoose from 'mongoose';
import { TransactionType, TransactionCategory, SessionStatus, UserRole } from '../../common/enums/enum.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { BarcodeUtil } from '../../common/utils/barcode.util.js';

export class ReportsService {

    // ══════════════════════════════════════════════════════════════
    // 1. Student Report — full picture of one student
    // ══════════════════════════════════════════════════════════════
    static async getStudentReport(studentId: string, teacherId: string) {
        const student = await StudentModel.findOne({ _id: studentId, teacherId }, {
            studentName: 1, parentName: 1, studentPhone: 1, parentPhone: 1,
            gradeLevel:  1, groupId: 1, isActive: 1, studentCode: 1,
        }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        // Get group name — scoped to same teacher for safety
        const group = await GroupModel.findOne({ _id: student.groupId, teacherId }, { name: 1 }).lean();

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

        // Build attendance history (per snapshot, last 30 entries)
        const attendanceHistory = snapshots.slice(0, 30).map((snap: any) => {
            const isPresent = snap.presentStudents.some((s: any) => s.studentId.toString() === studentId);
            const isAbsent  = snap.absentStudents.some((s: any)  => s.studentId.toString() === studentId);
            const status    = isPresent ? 'PRESENT' : isAbsent ? 'ABSENT' : 'GUEST';
            if (isPresent) presentCount++;
            else if (isAbsent) absentCount++;
            return { date: snap.date, status };
        });

        // Fix counts: iterate remaining snapshots not in history
        for (const snap of snapshots.slice(30)) {
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

        // Active subscription this month?
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const hasActiveSubscription = subscriptions.some(
            s => new Date(s.date) >= monthStart && new Date(s.date) <= monthEnd
        );

        // Generate Barcode Image using the studentCode (or barcode if they have a physical card)
        const codeToEncode = student.barcode || (student as any).studentCode || student._id.toString().substring(0, 10);
        let barcodeImageBase64 = '';
        try {
            barcodeImageBase64 = await BarcodeUtil.generateBase64Barcode(codeToEncode);
        } catch (e) {
            console.error('Failed to generate barcode image:', e);
        }

        return {
            student: {
                ...student,
                groupName: group?.name ?? '—',
                barcodeImageBase64,
                hasActiveSubscription,
            },
            attendance: {
                totalSessions,
                presentCount,
                absentCount,
                attendanceRate: `${attendanceRate}%`,
                history: attendanceHistory,
            },
            payments: {
                totalPaid,
                totalDiscount,
                subscriptionsCount:  subscriptions.length,
                notebookSalesCount:  notebookSales.length,
                subscriptions,
                history: payments,
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
    static async getDashboardSummary(teacherId: string, role: UserRole) {
        const now   = new Date();
        const year  = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth   = new Date(Date.UTC(year, month, 1));

        // 1. Existing Quick Stats (Shared between Teacher and Assistant)
        const [
            totalStudents,
            totalGroups,
            sessionsThisMonth,
        ] = await Promise.all([
            StudentModel.countDocuments({ teacherId, isActive: true }),
            GroupModel.countDocuments({ teacherId }),
            SessionModel.countDocuments({
                teacherId,
                date:   { $gte: startOfMonth },
                status: SessionStatus.COMPLETED,
            }),
        ]);

        // If the user is an assistant, return only basic functional stats
        if (role === UserRole.assistant) {
            return {
                totalStudents,
                totalGroups,
                sessionsThisMonth,
                message: "مرحباً بك في لوحة تحكم المساعد. من هنا يمكنك إدارة المجموعات والطلاب وأخذ الغياب."
                // No financial data or charts provided to the assistant
            };
        }

        // If the user is a teacher, fetch full financial and chart data
        const monthlyLedger = await MonthlyLedgerModel.findOne({ teacherId, year, month }, {
            totalIncome: 1, totalExpenses: 1, netBalance: 1,
        }).lean();

        // 2. Charts Data (Parallel Execution)
        // a. Expenses Breakdown (This Month)
        const expensesBreakdownPromise = TransactionModel.aggregate([
            {
                $match: {
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    type: TransactionType.EXPENSE,
                    date: { $gte: startOfMonth, $lt: endOfMonth }
                }
            },
            {
                $group: {
                    _id: '$category',
                    value: { $sum: '$paidAmount' }
                }
            },
            {
                $project: {
                    name: '$_id',
                    value: 1,
                    _id: 0
                }
            }
        ]);

        // b. Students Per Group
        const studentsPerGroupPromise = StudentModel.aggregate([
            {
                $match: {
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    isActive: true
                }
            },
            {
                $group: {
                    _id: '$groupId',
                    studentCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'groups',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'groupDetails'
                }
            },
            {
                $project: {
                    groupName: { $arrayElemAt: ['$groupDetails.name', 0] },
                    studentCount: 1,
                    _id: 0
                }
            }
        ]);

        // c. Income Trend (Last 6 Months) — correct cross-year boundary filter
        // Build an array of {year, month} pairs for the last 6 months inclusive
        const last6Months: { year: number; month: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(Date.UTC(year, month - 1 - i, 1));
            last6Months.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
        }
        const incomeTrendPromise = MonthlyLedgerModel.find(
            {
                teacherId,
                $or: last6Months.map(({ year: y, month: m }) => ({ year: y, month: m })),
            },
            { year: 1, month: 1, totalIncome: 1 }
        )
        .sort({ year: 1, month: 1 })
        .lean();

        const [expensesBreakdown, studentsPerGroup, rawIncomeTrend] = await Promise.all([
            expensesBreakdownPromise,
            studentsPerGroupPromise,
            incomeTrendPromise
        ]);

        // Format the income trend for the chart — Arabic month names
        const monthNamesAr = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
        // Fill in months with zero income so every month in the range has an entry
        const rawMap = new Map(rawIncomeTrend.map(l => [`${l.year}-${l.month}`, l.totalIncome]));
        const incomeTrend = last6Months.map(({ year: y, month: m }) => ({
            month: monthNamesAr[m - 1] ?? String(m),
            income: rawMap.get(`${y}-${m}`) ?? 0,
        }));

        return {
            totalStudents,
            totalGroups,
            sessionsThisMonth,
            financial: {
                totalIncome:   monthlyLedger?.totalIncome   ?? 0,
                totalExpenses: monthlyLedger?.totalExpenses ?? 0,
                netBalance:    monthlyLedger?.netBalance    ?? 0,
            },
            charts: {
                expensesBreakdown,
                studentsPerGroup,
                incomeTrend
            }
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 5. Daily Summary — end-of-day recap for teacher/assistant
    // ══════════════════════════════════════════════════════════════
    static async getDailySummary(teacherId: string, dateStr?: string) {
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
        const dayEnd   = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

        const tid = new mongoose.Types.ObjectId(teacherId);

        // Sessions completed today
        const completedSessions = await SessionModel.find({
            teacherId: tid,
            status: SessionStatus.COMPLETED,
            date: { $gte: dayStart, $lte: dayEnd },
        }, { _id: 1 }).lean();

        const completedSessionIds = completedSessions.map(s => s._id);
        const sessionsCount = completedSessions.length;

        // Total students present in those sessions (from snapshots)
        let totalPresent = 0;
        if (completedSessionIds.length > 0) {
            const snapshots = await AttendanceSnapshotModel.find(
                { sessionId: { $in: completedSessionIds } },
                { presentCount: 1 }
            ).lean();
            totalPresent = snapshots.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
        }

        // Subscriptions recorded today
        const subscriptionsCount = await TransactionModel.countDocuments({
            teacherId: tid,
            type: TransactionType.INCOME,
            category: TransactionCategory.SUBSCRIPTION,
            date: { $gte: dayStart, $lte: dayEnd },
        });

        // Daily financial summary
        const dateKey = dayStart.toISOString().split('T')[0]; // YYYY-MM-DD
        const dailyLedger = await DailyLedgerModel.findOne({ teacherId: tid, date: dateKey } as any).lean();

        return {
            date: dateKey,
            sessionsCount,
            totalPresent,
            subscriptionsCount,
            financial: {
                totalIncome:   dailyLedger?.totalIncome   ?? 0,
                totalExpenses: dailyLedger?.totalExpenses ?? 0,
                netBalance:    dailyLedger?.netBalance    ?? 0,
            },
        };
    }
}
