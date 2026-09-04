import { StudentModel }            from '../../database/models/student.model.js';
import { GroupModel }              from '../../database/models/group.model.js';
import { AttendanceModel }         from '../../database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../database/models/attendance-snapshot.model.js';
import { TransactionModel }        from '../../database/models/transaction.model.js';
import { CycleEnrollmentModel }    from '../../database/models/cycle-enrollment.model.js';
import { SessionModel }            from '../../database/models/session.model.js';
import { DailyLedgerModel, MonthlyLedgerModel } from '../../database/models/ledger.model.js';
import { ExamResultModel }         from '../../database/models/exam-result.model.js';
import { ExamModel }               from '../../database/models/exam.model.js';
import { UserModel }               from '../../database/models/user.model.js';
import mongoose from 'mongoose';
import { TransactionType, TransactionCategory, SessionStatus, UserRole, AttendanceStatus, CycleEnrollmentStatus } from '../../common/enums/enum.service.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { BarcodeUtil } from '../../common/utils/barcode.util.js';
import { cache, CacheKeys, CacheTTL } from '../../infrastructure/cache/cache.service.js';
import { logger } from '../../common/utils/logger.util.js';
import { todayEgypt, egyptDayBounds, startOfDayEgypt } from '../../common/utils/date.util.js';

export class ReportsService {

    // ══════════════════════════════════════════════════════════════
    // 1. Student Report — full picture of one student
    // ══════════════════════════════════════════════════════════════
    static async getStudentReport(
        studentId: string,
        teacherId: string,
        teacherDoc?: { features?: { homeworkTracking?: boolean } } | null,
    ) {
        const student = await StudentModel.findOne({ _id: studentId, teacherId }, {
            studentName: 1, parentName: 1, studentPhone: 1, parentPhone: 1,
            gradeLevel:  1, groupId: 1, isActive: 1, studentCode: 1,
            monthlySessionsQuota: 1, remainingSessions: 1,
        }).lean();
        if (!student) throw NotFoundException({ message: 'الطالب غير موجود' });

        const resolvedTeacher = teacherDoc ?? await UserModel.findById(teacherId, { features: 1 }).lean();
        const isHomeworkEnabled = Boolean(resolvedTeacher?.features?.homeworkTracking);

        // Get group name and cycle — scoped to same teacher for safety
        const group = await GroupModel.findOne({ _id: student.groupId, teacherId }, { name: 1, cycle: 1 }).lean();

        // Attendance history & counts from snapshots
        // We fetch snapshots and deduplicate per date so same-day guest/absent/compensation entries count accurately as 1 session
        const snapshots = await AttendanceSnapshotModel.find({
            teacherId,
            $or: [
                { 'presentStudents.studentId': student._id },
                { 'absentStudents.studentId':  student._id },
                { 'guestStudents.studentId':   student._id },
            ],
        }, {
            date: 1, sessionId: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1,
        }).sort({ date: -1 }).lean();

        // Map and deduplicate by date (priority: PRESENT/LATE (4) > GUEST (3) > EXCUSED (2) > ABSENT (1))
        const dayMap = new Map<string, { sessionId?: any; date: Date; status: string; homeworkDone?: boolean | null; priority: number }>();

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
                    dayMap.set(dayKey, { sessionId: snap.sessionId, date: snap.date, status, homeworkDone, priority });
                }
            }
        }

        const deduplicatedEntries = Array.from(dayMap.values()).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        // When a student attended as a GUEST in another group, that GUEST session is already listed in history as their attendance.
        // Therefore, we do not show redundant phantom EXCUSED entries for their home group's session that was compensated.
        const guestCount = deduplicatedEntries.filter(e => e.status === 'GUEST').length;
        let availableGuestCredits = guestCount;

        const effectiveEntries = deduplicatedEntries.filter(e => {
            if (e.status === AttendanceStatus.EXCUSED) {
                if (availableGuestCredits > 0) {
                    availableGuestCredits--;
                    return false; // Suppress phantom compensated absence card from student profile
                }
            }
            return true;
        });

        const presentCount = effectiveEntries.filter(
            e => e.status === AttendanceStatus.PRESENT || e.status === AttendanceStatus.LATE || e.status === 'GUEST' || e.status === AttendanceStatus.EXCUSED
        ).length;
        const absentCount  = effectiveEntries.filter(e => e.status === AttendanceStatus.ABSENT).length;
        const attendanceHistory = effectiveEntries.slice(0, 30).map(e => ({
            sessionId: e.sessionId,
            date: e.date,
            status: e.status,
            homeworkDone: isHomeworkEnabled ? (e.homeworkDone ?? null) : null,
        }));

        const totalSessions  = presentCount + absentCount;
        const attendanceRate = totalSessions > 0
            ? Math.round((presentCount / totalSessions) * 100)
            : 0;

        // Payment history — last 50 entries + totals via aggregation
        const [payments, paymentTotals] = await Promise.all([
            TransactionModel.find({
                teacherId,
                studentId:  student._id,
                type:       TransactionType.INCOME,
            }, {
                category: 1, paidAmount: 1, originalAmount: 1,
                discountAmount: 1, date: 1, description: 1,
            }).sort({ date: -1 }).limit(50).lean(),
            TransactionModel.aggregate([
                { $match: { teacherId: new mongoose.Types.ObjectId(teacherId), studentId: student._id, type: TransactionType.INCOME } },
                { $group: {
                    _id: '$category',
                    total: { $sum: '$paidAmount' },
                    totalDiscount: { $sum: '$discountAmount' },
                    count: { $sum: 1 },
                }},
            ]),
        ]);

        const totalPaid     = paymentTotals.reduce((sum: number, p: any) => sum + p.total, 0);
        const totalDiscount = paymentTotals.reduce((sum: number, p: any) => sum + p.totalDiscount, 0);
        const subscriptionsCount = paymentTotals.find((p: any) => p._id === TransactionCategory.SUBSCRIPTION)?.count ?? 0;
        const notebookSalesCount = paymentTotals.find((p: any) => p._id === TransactionCategory.NOTEBOOK_SALE)?.count ?? 0;

        // Active subscription and cycle enrollments
        const currentCycleNumber = (group as any)?.cycle?.currentCycleNumber || 1;

        const allEnrollments = await CycleEnrollmentModel.find({
            studentId: student._id,
            teacherId
        }).sort({ cycleNumber: -1 }).lean();

        const cycleEnrollments = allEnrollments.map(e => ({
            _id: e._id,
            cycleNumber: e.cycleNumber,
            cycleCapacity: e.cycleCapacity,
            pricePerSession: e.pricePerSession,
            fullCyclePrice: e.fullCyclePrice,
            startSession: e.startSession,
            chargeableSessions: e.chargeableSessions,
            cycleCharge: e.cycleCharge,
            totalPaid: e.totalPaid,
            remainingAmount: e.remainingAmount,
            status: e.status,
            isCurrentCycle: e.cycleNumber === currentCycleNumber,
            isPastCycle: e.cycleNumber < currentCycleNumber,
            createdAt: (e as any).createdAt,
        }));

        const currentCycleEnrollment = cycleEnrollments.find(e => e.isCurrentCycle);
        const hasActiveSubscription = currentCycleEnrollment?.status === CycleEnrollmentStatus.PAID;
        const pastUnpaidCycles = cycleEnrollments.filter(e => e.isPastCycle && e.status !== CycleEnrollmentStatus.PAID);
        const pastCyclesDebt = pastUnpaidCycles.reduce((sum, e) => sum + e.remainingAmount, 0);

        // ── Lesson Cycle Attendance Calculation ──────────────────────
        const rawCycleStartedAt = (group as any)?.cycle?.startedAt;
        const cycleStartedAt = startOfDayEgypt(rawCycleStartedAt);

        // 1. Get all non-cancelled sessions for the group in the current cycle
        const groupSessions = await SessionModel.find({
            groupId: student.groupId,
            teacherId,
            date: { $gte: cycleStartedAt },
            status: { $ne: SessionStatus.CANCELLED }
        }).sort({ date: 1, startTime: 1 }).lean();

        const sessionIds = groupSessions.map(s => s._id);

        // 2. Get attendance records and snapshots for these group sessions + any guest attendances in the cycle
        const [attendedRecords, sessionSnapshots, guestRecords] = await Promise.all([
            AttendanceModel.find({
                studentId,
                sessionId: { $in: sessionIds as any },
            }).lean(),
            AttendanceSnapshotModel.find({
                sessionId: { $in: sessionIds as any },
            }).lean(),
            AttendanceModel.find({
                studentId,
                isGuest: true,
                status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] },
                scannedAt: { $gte: cycleStartedAt },
            }).lean(),
        ]);

        const attendedMap = new Map<string, AttendanceStatus>();
        attendedRecords.forEach(a => {
            if (a.sessionId) attendedMap.set(a.sessionId.toString(), a.status as AttendanceStatus);
        });

        // Complement with snapshots (in case snapshot exists but AttendanceModel wasn't persisted individually)
        sessionSnapshots.forEach(snap => {
            const sid = snap.sessionId.toString();
            if (!attendedMap.has(sid)) {
                if (snap.presentStudents?.some(p => p.studentId.toString() === studentId && p.status !== AttendanceStatus.EXCUSED)) {
                    attendedMap.set(sid, AttendanceStatus.PRESENT);
                } else if (snap.presentStudents?.some(p => p.studentId.toString() === studentId && p.status === AttendanceStatus.EXCUSED)) {
                    attendedMap.set(sid, AttendanceStatus.EXCUSED);
                } else if (snap.guestStudents?.some(g => g.studentId.toString() === studentId)) {
                    attendedMap.set(sid, AttendanceStatus.PRESENT);
                } else if (snap.absentStudents?.some(a => a.studentId.toString() === studentId)) {
                    attendedMap.set(sid, AttendanceStatus.ABSENT);
                }
            }
        });

        // 3. Map sessions with cross-date guest compensation
        const matchedGuestIds = new Set<string>();

        const monthlySessions = groupSessions.map(s => {
            let status = attendedMap.get(s._id.toString());
            const sessionDateKey = s.date ? new Date(s.date).toISOString().split('T')[0] : '';

            if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE || status === AttendanceStatus.EXCUSED) {
                return { sessionId: s._id, date: s.date, status };
            }

            // Check if there is a guest record on the exact same date
            const exactGuest = guestRecords.find(g => {
                const gd = g.scannedAt ? new Date(g.scannedAt).toISOString().split('T')[0] : '';
                return gd === sessionDateKey && !matchedGuestIds.has(g._id.toString());
            });

            if (exactGuest) {
                matchedGuestIds.add(exactGuest._id.toString());
                status = AttendanceStatus.EXCUSED;
            }

            return {
                sessionId: s._id,
                date:      s.date,
                status:    status || AttendanceStatus.ABSENT,
            };
        });

        // 4. Manual records in the cycle (not linked to group sessions)
        const manualRecordsCount = await AttendanceModel.countDocuments({
            studentId,
            sessionId: { $exists: false },
            type:      'MANUAL',
            scannedAt: { $gte: cycleStartedAt },
            status:    { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] }
        });

        const activeAttendedCount = monthlySessions.filter(
            s => s.status === AttendanceStatus.PRESENT || s.status === AttendanceStatus.LATE || s.status === AttendanceStatus.EXCUSED
        ).length;

        const usedSessionsThisMonth = activeAttendedCount + manualRecordsCount;

        // Remaining sessions is deprecated
        const remainingSessions = 0;

        // Generate Barcode Image using the studentCode (or barcode if they have a physical card)
        const codeToEncode = student.barcode || (student as any).studentCode || student._id.toString().substring(0, 10);
        let barcodeImageBase64 = '';
        try {
            barcodeImageBase64 = await BarcodeUtil.generateBase64Barcode(codeToEncode);
        } catch (e) {
            logger.warn('barcode_generation_failed', { studentId, error: (e as Error).message });
        }

        // ── Exam Results — student's full exam history ───────────────
        const examResults = await ExamResultModel.find(
            { teacherId, studentId: student._id },
            { examId: 1, score: 1, totalMarks: 1, passingMarks: 1, percentage: 1, grade: 1, passed: 1, date: 1 }
        ).sort({ date: -1 }).lean();

        // Populate exam titles
        const examIds = [...new Set(examResults.map(r => r.examId.toString()))];
        const exams   = await ExamModel.find(
            { _id: { $in: examIds } },
            { title: 1 }
        ).lean();
        const examTitleMap = new Map(exams.map(e => [e._id.toString(), e.title]));

        const gradesHistory = examResults.map(r => ({
            examId:      r.examId,
            examTitle:   examTitleMap.get(r.examId.toString()) ?? 'امتحان',
            score:       r.score,
            totalMarks:  r.totalMarks,
            passingMarks: r.passingMarks,
            percentage:  r.percentage,
            grade:       r.grade,
            passed:      r.passed,
            date:        r.date,
        }));

        const quota = student.monthlySessionsQuota
            || (group as any)?.cycle?.capacity
            || (group?.schedule?.length ? group.schedule.length * 4 : 8);

        return {
            student: {
                ...student,
                groupName: group?.name ?? '—',
                barcodeImageBase64,
                hasActiveSubscription: !!hasActiveSubscription,
                monthlySessionsQuota: quota,
                remainingSessions,
                usedSessionsThisMonth,
                monthlySessions, // Send the real session list
                manualRecordsCount,
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
                subscriptionsCount,
                notebookSalesCount,
                history: payments,
                subscriptions: payments.filter((p: any) => p.category === TransactionCategory.SUBSCRIPTION),
                cycleEnrollments,
                pastUnpaidCycles,
                pastCyclesDebt,
                currentCycleNumber,
                currentCycleEnrollment,
            },
            grades: {
                total: gradesHistory.length,
                history: gradesHistory,
            },
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 2. Group Report — attendance + revenue + student statuses for a group
    // ══════════════════════════════════════════════════════════════
    static async getGroupReport(groupId: string, teacherId: string) {
        const group = await GroupModel.findOne({ _id: groupId, teacherId }).lean();
        if (!group) throw NotFoundException({ message: 'المجموعة غير موجودة' });

        const currentCycleNumber = (group as any)?.cycle?.currentCycleNumber || 1;
        const cycleCapacity = (group as any)?.cycle?.capacity || (group?.schedule?.length ? group.schedule.length * 4 : 8);

        // Fetch active students in group
        const students = await StudentModel.find(
            { groupId, teacherId, isActive: true },
            { studentName: 1, studentPhone: 1, parentPhone: 1, studentCode: 1, gradeLevel: 1, createdAt: 1 }
        ).sort({ studentName: 1 }).lean();

        const totalStudents = students.length;
        const studentIds = students.map(s => s._id);

        // All completed sessions for this group
        const sessions = await SessionModel.find({
            groupId, teacherId, status: SessionStatus.COMPLETED,
        }, { _id: 1, date: 1 }).lean();

        const sessionIds = sessions.map(s => s._id);

        // Snapshots for completed sessions
        const snapshots = await AttendanceSnapshotModel.find(
            { sessionId: { $in: sessionIds } },
            { date: 1, presentCount: 1, absentCount: 1, totalCount: 1, presentStudents: 1, absentStudents: 1, guestStudents: 1 }
        ).sort({ date: -1 }).limit(100).lean();

        // Calculate attendance counts
        let totalSessions = snapshots.length;
        let totalPresences = 0;
        let totalAbsences = 0;

        // Map student attendance count: studentId -> { present: number, absent: number }
        const studentAttendanceStats = new Map<string, { present: number; absent: number }>();
        studentIds.forEach(id => studentAttendanceStats.set(id.toString(), { present: 0, absent: 0 }));

        snapshots.forEach(snap => {
            totalPresences += (snap.presentCount || 0);
            totalAbsences += (snap.absentCount || 0);

            snap.presentStudents?.forEach((p: any) => {
                const sid = p.studentId?.toString();
                if (studentAttendanceStats.has(sid)) {
                    studentAttendanceStats.get(sid)!.present += 1;
                }
            });
            snap.absentStudents?.forEach((a: any) => {
                const sid = a.studentId?.toString();
                if (studentAttendanceStats.has(sid)) {
                    studentAttendanceStats.get(sid)!.absent += 1;
                }
            });
            snap.guestStudents?.forEach((g: any) => {
                const sid = g.studentId?.toString();
                if (studentAttendanceStats.has(sid)) {
                    studentAttendanceStats.get(sid)!.present += 1;
                }
            });
        });

        const avgAttendanceRate = (totalPresences + totalAbsences) > 0
            ? Math.round((totalPresences / (totalPresences + totalAbsences)) * 100)
            : 0;

        // Current Cycle Enrollments for these students
        const enrollments = await CycleEnrollmentModel.find({
            studentId: { $in: studentIds },
            groupId: group._id,
            cycleNumber: currentCycleNumber
        }).lean();

        const enrollmentMap = new Map(enrollments.map(e => [e.studentId.toString(), e]));

        // Check subscription transactions for current cycle
        const subscriptionTxs = await TransactionModel.find({
            teacherId,
            studentId: { $in: studentIds },
            category: TransactionCategory.SUBSCRIPTION,
            cycleNumber: currentCycleNumber
        }, { studentId: 1, paidAmount: 1 }).lean();

        const paidTxSet = new Set(subscriptionTxs.map(t => t.studentId?.toString()));

        // Calculate paid and unpaid students
        let paidStudentsCount = 0;
        const studentsListWithStatus = students.map(s => {
            const sid = s._id.toString();
            const enrollment = enrollmentMap.get(sid);
            const isPaid = (enrollment && (enrollment.status === CycleEnrollmentStatus.PAID || enrollment.remainingAmount <= 0 || (enrollment.totalPaid && enrollment.totalPaid > 0))) || paidTxSet.has(sid);

            if (isPaid) paidStudentsCount++;

            const attStats = studentAttendanceStats.get(sid) || { present: 0, absent: 0 };
            const studentTotalSessions = attStats.present + attStats.absent;
            const rate = studentTotalSessions > 0 ? Math.round((attStats.present / studentTotalSessions) * 100) : 100;

            return {
                _id: s._id,
                studentName: s.studentName,
                studentCode: (s as any).studentCode || '—',
                studentPhone: s.studentPhone || '—',
                parentPhone: (s as any).parentPhone || '—',
                hasActiveSubscription: !!isPaid,
                paidAmount: enrollment?.totalPaid || 0,
                attendanceRate: `${rate}%`,
                presentCount: attStats.present,
                absentCount: attStats.absent,
            };
        });

        const unpaidStudentsCount = Math.max(0, totalStudents - paidStudentsCount);

        // Revenue Breakdown for students in this group
        const revenue = await TransactionModel.aggregate([
            {
                $match: {
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    studentId: { $in: studentIds },
                    type: TransactionType.INCOME,
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$paidAmount' },
                    count: { $sum: 1 },
                    totalDiscount: { $sum: '$discountAmount' },
                },
            },
        ]);

        const subscriptionsSummary = revenue.find(r => r._id === TransactionCategory.SUBSCRIPTION) || { total: 0, count: 0 };
        const notebooksSummary = revenue.find(r => r._id === TransactionCategory.NOTEBOOK_SALE) || { total: 0, count: 0 };
        const totalRevenue = revenue.reduce((sum, r) => sum + (r.total || 0), 0);

        return {
            group: {
                _id: group._id,
                name: group.name,
                gradeLevel: group.gradeLevel,
                schedule: group.schedule,
                totalStudents,
                capacity: (group as any).capacity || 50,
                currentCycleNumber,
                cycleCapacity,
            },
            stats: {
                totalStudents,
                paidStudentsCount,
                unpaidStudentsCount,
                notebooksSoldQuantity: notebooksSummary.count,
                notebooksRevenue: notebooksSummary.total,
                subscriptionsCount: subscriptionsSummary.count,
                subscriptionsRevenue: subscriptionsSummary.total,
                totalRevenue,
            },
            attendance: {
                totalSessions,
                totalPresences,
                totalAbsences,
                avgAttendanceRate: `${avgAttendanceRate}%`,
                sessionsHistory: snapshots.map(s => ({
                    _id: s._id,
                    date: s.date,
                    presentCount: s.presentCount || 0,
                    absentCount: s.absentCount || 0,
                })),
            },
            students: studentsListWithStatus,
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
                stats: {
                    totalIncome: 0,
                    totalExpenses: 0,
                    netBalance: 0,
                    subscriptionsCount: 0,
                    subscriptionsRevenue: 0,
                    notebooksSoldQuantity: 0,
                    notebooksRevenue: 0,
                },
                dailySummaries: [],
                breakdown: [],
            };
        }

        // Breakdown by category (from Transaction model)
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth   = new Date(Date.UTC(year, month, 1));

        const [breakdown, transactions] = await Promise.all([
            TransactionModel.aggregate([
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
            ]),
            TransactionModel.find({
                teacherId: ledger.teacherId,
                date: { $gte: startOfMonth, $lt: endOfMonth },
            }, { type: 1, category: 1, paidAmount: 1 }).lean(),
        ]);

        let subscriptionsRevenue = 0;
        let subscriptionsCount = 0;
        let notebooksRevenue = 0;
        let notebooksSoldQuantity = 0;

        transactions.forEach(t => {
            if (t.type === TransactionType.INCOME) {
                if (t.category === TransactionCategory.SUBSCRIPTION) {
                    subscriptionsRevenue += (t.paidAmount || 0);
                    subscriptionsCount += 1;
                } else if (t.category === TransactionCategory.NOTEBOOK_SALE || t.category === TransactionCategory.NOTEBOOK_RESERVATION) {
                    notebooksRevenue += (t.paidAmount || 0);
                    notebooksSoldQuantity += 1;
                }
            }
        });

        return {
            year,
            month,
            totalIncome:    ledger.totalIncome,
            totalExpenses:  ledger.totalExpenses,
            netBalance:     ledger.netBalance,
            stats: {
                totalIncome: ledger.totalIncome,
                totalExpenses: ledger.totalExpenses,
                netBalance: ledger.netBalance,
                subscriptionsCount,
                subscriptionsRevenue,
                notebooksSoldQuantity,
                notebooksRevenue,
            },
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
        // Check cache first
        const cacheKey = CacheKeys.dashboard(teacherId);
        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const now   = new Date();
        const year  = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;

        // 1. Basic Stats (Parallel Execution)
        const [totalStudents, activeStudents, totalGroups, todaySessionsCount] = await Promise.all([
            StudentModel.countDocuments({ teacherId }),
            StudentModel.countDocuments({ teacherId, isActive: true }),
            GroupModel.countDocuments({ teacherId }),
            SessionModel.countDocuments({
                teacherId,
                date: {
                    $gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)),
                    $lt:  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)),
                },
            }),
        ]);

        const baseStats = {
            totalStudents,
            activeStudents,
            totalGroups,
            todaySessionsCount,
        };

        // If the user is an assistant, return basic stats and minimal charts
        if (role === UserRole.assistant) {
            const assistantData = {
                ...baseStats,
                financial: { totalIncome: 0, totalExpenses: 0, netBalance: 0 },
                charts: {
                    expensesBreakdown: [],
                    studentsPerGroup: [],
                    incomeTrend: [],
                    attendanceTrend: [],
                }
            };
            // Cache assistant summary for 60s
            await cache.set(cacheKey, assistantData, CacheTTL.DASHBOARD);
            return assistantData;
        }

        // If the user is a teacher, fetch full financial and chart data
        const monthlyLedger = await MonthlyLedgerModel.findOne({ teacherId, year, month }, {
            totalIncome: 1, totalExpenses: 1, netBalance: 1,
        }).lean();

        // 2. Charts Data (Parallel Execution)
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
        const endOfMonth   = new Date(Date.UTC(year, month, 1));

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

        const attendanceTrendPromise = AttendanceSnapshotModel.find(
            { teacherId },
            { date: 1, presentCount: 1, absentCount: 1 }
        )
        .sort({ date: -1 })
        .limit(8)
        .lean();

        const sessionsThisMonthPromise = SessionModel.countDocuments({
            teacherId,
            date: { $gte: startOfMonth, $lt: endOfMonth },
            status: SessionStatus.COMPLETED
        });

        const notebooksThisMonthPromise = TransactionModel.aggregate([
            {
                $match: {
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    type: TransactionType.INCOME,
                    category: { $in: [TransactionCategory.NOTEBOOK_SALE, TransactionCategory.NOTEBOOK_RESERVATION] },
                    date: { $gte: startOfMonth, $lt: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: 1 },
                    totalRevenue: { $sum: '$paidAmount' }
                }
            }
        ]);

        const subscriptionsThisMonthPromise = TransactionModel.aggregate([
            {
                $match: {
                    teacherId: new mongoose.Types.ObjectId(teacherId),
                    type: TransactionType.INCOME,
                    category: TransactionCategory.SUBSCRIPTION,
                    date: { $gte: startOfMonth, $lt: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalRevenue: { $sum: '$paidAmount' }
                }
            }
        ]);

        const [expensesBreakdown, studentsPerGroup, rawIncomeTrend, rawAttendanceSnapshots, sessionsThisMonth, rawNotebooks, rawSubscriptions] = await Promise.all([
            expensesBreakdownPromise,
            studentsPerGroupPromise,
            incomeTrendPromise,
            attendanceTrendPromise,
            sessionsThisMonthPromise,
            notebooksThisMonthPromise,
            subscriptionsThisMonthPromise,
        ]);

        // Transform charts to clean objects
        const incomeTrend = rawIncomeTrend.map(item => ({
            month: `${item.year}-${String(item.month).padStart(2, '0')}`,
            income: item.totalIncome,
        }));

        const attendanceTrend = rawAttendanceSnapshots.reverse().map(item => ({
            date: item.date ? item.date.toISOString().split('T')[0] : '',
            present: item.presentCount,
            absent: item.absentCount,
        }));

        const notebooksStats = rawNotebooks[0] || { totalQuantity: 0, totalRevenue: 0 };
        const subscriptionsStats = rawSubscriptions[0] || { totalCount: 0, totalRevenue: 0 };

        const result = {
            ...baseStats,
            sessionsThisMonth,
            notebooks: {
                totalQuantity: notebooksStats.totalQuantity,
                totalRevenue: notebooksStats.totalRevenue,
            },
            subscriptions: {
                totalCount: subscriptionsStats.totalCount,
                totalRevenue: subscriptionsStats.totalRevenue,
            },
            financial: {
                totalIncome:   monthlyLedger?.totalIncome   ?? 0,
                totalExpenses: monthlyLedger?.totalExpenses ?? 0,
                netBalance:    monthlyLedger?.netBalance    ?? 0,
            },
            charts: {
                expensesBreakdown,
                studentsPerGroup,
                incomeTrend,
                attendanceTrend,
            }
        };

        // Cache full dashboard for 60s
        await cache.set(cacheKey, result, CacheTTL.DASHBOARD);
        return result;
    }

    // ══════════════════════════════════════════════════════════════
    // 5. Daily Summary — end-of-day recap for teacher & assistant
    // ══════════════════════════════════════════════════════════════
    static async getDailySummary(teacherId: string, dateStr?: string) {
        // dateStr arrives as "YYYY-MM-DD" (local date chosen by the user).
        const dateKey = dateStr || todayEgypt();
        const parts   = dateKey.split('-').map(Number);
        const y = parts[0]!;
        const m = parts[1]!;
        const d = parts[2]!;
        const { dayStart, dayEnd } = egyptDayBounds(y, m, d);
        const tid = new mongoose.Types.ObjectId(teacherId);

        // Sessions completed today
        const completedSessions = await SessionModel.find({
            teacherId: tid,
            status: SessionStatus.COMPLETED,
            date: { $gte: dayStart, $lte: dayEnd },
        }, { _id: 1, groupId: 1, startTime: 1, endTime: 1 }).populate('groupId', 'name gradeLevel').lean();

        const completedSessionIds = completedSessions.map(s => s._id);
        const sessionsCount = completedSessions.length;

        // Total students present and absent in those sessions (from snapshots)
        let totalPresent = 0;
        let totalAbsent = 0;
        let snapshotsList: any[] = [];
        if (completedSessionIds.length > 0) {
            snapshotsList = await AttendanceSnapshotModel.find(
                { sessionId: { $in: completedSessionIds } },
                { sessionId: 1, presentCount: 1, absentCount: 1, totalCount: 1, date: 1 }
            ).lean();
            totalPresent = snapshotsList.reduce((sum, s) => sum + (s.presentCount ?? 0), 0);
            totalAbsent = snapshotsList.reduce((sum, s) => sum + (s.absentCount ?? 0), 0);
        }

        // Transactions today
        const txs = await TransactionModel.find({
            teacherId: tid,
            date: { $gte: dayStart, $lte: dayEnd },
        }).sort({ date: -1 }).lean();

        let subscriptionsRevenue = 0;
        let subscriptionsCount = 0;
        let notebooksRevenue = 0;
        let notebooksSoldQuantity = 0;
        let totalIncome = 0;
        let totalExpenses = 0;

        txs.forEach(t => {
            if (t.type === TransactionType.INCOME) {
                totalIncome += (t.paidAmount || 0);
                if (t.category === TransactionCategory.SUBSCRIPTION) {
                    subscriptionsRevenue += (t.paidAmount || 0);
                    subscriptionsCount += 1;
                } else if (t.category === TransactionCategory.NOTEBOOK_SALE || t.category === TransactionCategory.NOTEBOOK_RESERVATION) {
                    notebooksRevenue += (t.paidAmount || 0);
                    notebooksSoldQuantity += 1;
                }
            } else if (t.type === TransactionType.EXPENSE) {
                totalExpenses += (t.paidAmount || 0);
            }
        });

        const netBalance = totalIncome - totalExpenses;

        return {
            date: dateKey,
            sessionsCount,
            totalPresent,
            totalAbsent,
            subscriptionsCount,
            subscriptionsRevenue,
            notebooksSoldQuantity,
            notebooksRevenue,
            completedSessions: completedSessions.map(s => {
                const snap = snapshotsList.find(sp => sp.sessionId?.toString() === s._id.toString());
                return {
                    _id: s._id,
                    groupName: (s.groupId as any)?.name || 'مجموعة',
                    gradeLevel: (s.groupId as any)?.gradeLevel || '—',
                    startTime: s.startTime,
                    presentCount: snap?.presentCount || 0,
                    absentCount: snap?.absentCount || 0,
                };
            }),
            stats: {
                totalIncome,
                totalExpenses,
                netBalance,
                subscriptionsCount,
                subscriptionsRevenue,
                notebooksSoldQuantity,
                notebooksRevenue,
            },
            financial: {
                totalIncome,
                totalExpenses,
                netBalance,
            },
            transactions: txs.map(t => ({
                _id: t._id,
                studentName: t.studentName || '—',
                category: t.category,
                type: t.type,
                paidAmount: t.paidAmount,
                description: t.description || '—',
                date: t.date,
            })),
        };
    }

    // ══════════════════════════════════════════════════════════════
    // 7. Unpaid Students — students who haven't paid for their current cycle
    // ══════════════════════════════════════════════════════════════
    static async getUnpaidStudents(teacherId: string, includeList = false) {
        const { StudentService } = await import('../students/students.service.js');
        const unpaidIds = await StudentService.getUnpaidStudentIds(teacherId);
        const totalActive = await StudentModel.countDocuments({ teacherId, isActive: true });
        const unpaidCount = unpaidIds.length;
        const paidCount = totalActive - unpaidCount;

        const now = new Date();
        const base = {
            month:       `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
            totalActive,
            unpaidCount: Math.max(0, unpaidCount),
            paidCount,
        };

        // ── Heavy part: only when caller explicitly requests the list ──
        if (!includeList) {
            return { ...base, students: [] };
        }

        const unpaidStudents = await StudentModel.find(
            { _id: { $in: unpaidIds.map((id: string) => new mongoose.Types.ObjectId(id)) } },
            { studentName: 1, gradeLevel: 1, groupId: 1, studentCode: 1, remainingSessions: 1, cycleStartedAt: 1, cycleCapacity: 1 }
        ).populate('groupId', 'name').sort({ studentName: 1 }).limit(100).lean();

        return { ...base, students: unpaidStudents };
    }
}
