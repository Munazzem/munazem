import { UserModel } from '../../database/models/user.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { SessionModel } from '../../database/models/session.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { OptOutModel } from '../../database/models/opt-out.model.js';
import { UserRole, SessionStatus, TransactionType, TransactionCategory } from '../../common/enums/enum.service.js';
import { enqueueWhatsApp, enqueueEmail } from '../../infrastructure/queues/whatsapp.queue.js';
import { logger } from '../../common/utils/logger.util.js';
// ─── Day-name helper (same mapping used in sessions.service.ts) ──────────────
const DAY_MAP = {
    'الأحد': 0, 'الاحد': 0,
    'الاثنين': 1, 'الإثنين': 1,
    'الثلاثاء': 2,
    'الأربعاء': 3, 'الاربعاء': 3,
    'الخميس': 4,
    'الجمعة': 5,
    'السبت': 6,
};
// Egypt UTC offset (UTC+2 base, but we simplify to +3 for EET summer)
const EGYPT_OFFSET_MS = 3 * 60 * 60 * 1000;
function egyptToday() {
    const now = new Date(Date.now() + EGYPT_OFFSET_MS);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function formatDateAr(date) {
    return date.toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
}
// ─── Weekly Teacher Report ───────────────────────────────────────────────────
/**
 * Collects financial & session data for the past 7 days for every active
 * teacher and enqueues an email job for each.
 */
export async function generateWeeklyReports(teacherId, forceTest = false) {
    const query = { role: UserRole.teacher, isActive: true };
    if (teacherId)
        query._id = teacherId;
    const teachers = await UserModel.find(query, { _id: 1, name: 1, email: 1 }).lean();
    if (teachers.length === 0) {
        logger.info('automation_weekly_no_teachers');
        return;
    }
    const today = egyptToday();
    const weekEnd = new Date(today);
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const weekStartStr = formatDateAr(weekStart);
    const weekEndStr = formatDateAr(weekEnd);
    logger.info('automation_weekly_start', { count: teachers.length, weekStart: weekStart.toISOString() });
    for (const teacher of teachers) {
        try {
            const tid = teacher._id.toString();
            // ── Income breakdown ──────────────────────────────────────────
            const incomeAgg = await TransactionModel.aggregate([
                { $match: { teacherId: teacher._id, type: TransactionType.INCOME, date: { $gte: weekStart, $lt: weekEnd } } },
                { $group: { _id: '$category', total: { $sum: '$paidAmount' } } },
            ]);
            const incomeMap = new Map(incomeAgg.map(r => [r._id, r.total]));
            const incomeSubscriptions = (incomeMap.get(TransactionCategory.SUBSCRIPTION) ?? 0);
            const incomeNotebooks = (incomeMap.get(TransactionCategory.NOTEBOOK_SALE) ?? 0)
                + (incomeMap.get(TransactionCategory.NOTEBOOK_RESERVATION) ?? 0)
                + (incomeMap.get(TransactionCategory.NOTEBOOK_DELIVERY) ?? 0);
            const incomeOther = (incomeMap.get(TransactionCategory.OTHER_INCOME) ?? 0);
            const totalIncome = incomeSubscriptions + incomeNotebooks + incomeOther;
            // ── Expense breakdown ─────────────────────────────────────────
            const expenseAgg = await TransactionModel.aggregate([
                { $match: { teacherId: teacher._id, type: TransactionType.EXPENSE, date: { $gte: weekStart, $lt: weekEnd } } },
                { $group: { _id: '$category', total: { $sum: '$paidAmount' } } },
            ]);
            const expenseMap = new Map(expenseAgg.map(r => [r._id, r.total]));
            const expenseSalaries = expenseMap.get(TransactionCategory.SALARY) ?? 0;
            const expenseRent = expenseMap.get(TransactionCategory.RENT) ?? 0;
            const expenseOther = (expenseMap.get(TransactionCategory.SUPPLIES) ?? 0)
                + (expenseMap.get(TransactionCategory.OTHER_EXPENSE) ?? 0);
            const totalExpenses = expenseSalaries + expenseRent + expenseOther;
            // ── Sessions ──────────────────────────────────────────────────
            const [completedSessions, cancelledSessions] = await Promise.all([
                SessionModel.countDocuments({
                    teacherId: teacher._id,
                    date: { $gte: weekStart, $lt: weekEnd },
                    status: SessionStatus.COMPLETED,
                }),
                SessionModel.countDocuments({
                    teacherId: teacher._id,
                    date: { $gte: weekStart, $lt: weekEnd },
                    status: SessionStatus.CANCELLED,
                }),
            ]);
            // ── Students ──────────────────────────────────────────────────
            const [totalStudents, unpaidStudents] = await Promise.all([
                StudentModel.countDocuments({ teacherId: teacher._id, isActive: true }),
                StudentModel.countDocuments({ teacherId: teacher._id, isActive: true, remainingSessions: 0 }),
            ]);
            // ── Enqueue email ─────────────────────────────────────────────
            if (teacher.email) {
                enqueueEmail({
                    kind: 'weekly_teacher_report',
                    teacherId: tid,
                    teacherName: teacher.name,
                    teacherEmail: teacher.email,
                    weekStart: weekStartStr,
                    weekEnd: weekEndStr,
                    incomeSubscriptions,
                    incomeNotebooks,
                    incomeOther,
                    totalIncome,
                    expenseSalaries,
                    expenseRent,
                    expenseOther,
                    totalExpenses,
                    netBalance: totalIncome - totalExpenses,
                    completedSessions,
                    cancelledSessions,
                    totalStudents,
                    unpaidStudents,
                }, forceTest);
            }
            else {
                logger.warn('automation_weekly_no_email', { teacherId: tid, teacherName: teacher.name });
            }
        }
        catch (err) {
            logger.error('automation_weekly_teacher_failed', {
                teacherId: teacher._id.toString(),
                error: err.message,
            });
        }
    }
    logger.info('automation_weekly_done', { count: teachers.length });
}
// ─── Payment Reminder ────────────────────────────────────────────────────────
/**
 * For each teacher, finds groups whose 2nd session of the month is TOMORROW.
 * For unpaid students in those groups, enqueues a WhatsApp reminder.
 *
 * Logic:
 * 1. Get all groups with schedules
 * 2. For each group, calculate the dates of scheduled sessions this month
 * 3. If the 2nd session date is tomorrow → find unpaid students in that group
 * 4. Check opt-out list and skip opted-out parents
 * 5. Enqueue WhatsApp reminder (dedup key prevents duplicates within a month)
 */
export async function generatePaymentReminders(teacherId) {
    const query = { role: UserRole.teacher, isActive: true, whatsappStatus: 'connected' };
    if (teacherId)
        query._id = teacherId;
    const teachers = await UserModel.find(query, { _id: 1, name: 1, phone: 1, subject: 1 }).lean();
    if (teachers.length === 0) {
        logger.info('automation_reminder_no_teachers');
        return;
    }
    const today = egyptToday();
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    // Start of current month
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    let totalReminders = 0;
    logger.info('automation_reminder_start', { teachers: teachers.length, tomorrow: tomorrow.toISOString() });
    for (const teacher of teachers) {
        try {
            const tid = teacher._id.toString();
            // Get all groups for this teacher
            const groups = await GroupModel.find({ teacherId: teacher._id, isActive: true }, { _id: 1, schedule: 1 }).lean();
            // Pre-fetch opted-out phones for this teacher
            const optedOut = new Set((await OptOutModel.find({ teacherId: teacher._id }, { phone: 1 }).lean())
                .map(o => o.phone));
            for (const group of groups) {
                if (!group.schedule || group.schedule.length === 0)
                    continue;
                // ── Calculate session dates this month for this group ─────
                const sessionDates = [];
                for (const slot of group.schedule) {
                    const targetDay = DAY_MAP[slot.day];
                    if (targetDay === undefined)
                        continue;
                    // Find first occurrence of this weekday in the month
                    const diff = (targetDay - monthStart.getUTCDay() + 7) % 7;
                    const firstOccurrence = new Date(monthStart);
                    firstOccurrence.setUTCDate(monthStart.getUTCDate() + diff);
                    let d = new Date(firstOccurrence);
                    while (d < monthEnd) {
                        sessionDates.push(new Date(d));
                        d.setUTCDate(d.getUTCDate() + 7);
                    }
                }
                // Sort chronologically
                sessionDates.sort((a, b) => a.getTime() - b.getTime());
                // We need the 2nd session — index 1
                if (sessionDates.length < 2)
                    continue;
                const secondSession = sessionDates[1];
                // Check if the 2nd session is TOMORROW
                if (secondSession.getTime() !== tomorrow.getTime())
                    continue;
                // ── Find unpaid students in this group ────────────────────
                const unpaidStudents = await StudentModel.find({
                    groupId: group._id,
                    teacherId: teacher._id,
                    isActive: true,
                    remainingSessions: 0,
                }, { studentName: 1, parentPhone: 1, gradeLevel: 1 }).lean();
                for (const student of unpaidStudents) {
                    // Check if parent has already paid this month
                    const hasPaid = await TransactionModel.exists({
                        teacherId: teacher._id,
                        studentId: student._id,
                        category: TransactionCategory.SUBSCRIPTION,
                        date: { $gte: monthStart, $lt: monthEnd },
                    });
                    if (hasPaid)
                        continue;
                    // Normalize phone for opt-out check
                    let normalizedPhone = student.parentPhone.replace(/\D/g, '');
                    if (normalizedPhone.startsWith('01'))
                        normalizedPhone = '2' + normalizedPhone;
                    else if (!normalizedPhone.startsWith('20') && normalizedPhone.length === 10)
                        normalizedPhone = '20' + normalizedPhone;
                    // Check opt-out
                    if (optedOut.has(normalizedPhone))
                        continue;
                    // Enqueue reminder (dedup key = one per parent per month)
                    enqueueWhatsApp({
                        kind: 'payment_reminder',
                        teacherId: tid,
                        parentPhone: student.parentPhone,
                        studentName: student.studentName,
                        gradeLevel: student.gradeLevel,
                        teacherName: teacher.subject ? `${teacher.name} (${teacher.subject})` : teacher.name,
                    });
                    totalReminders++;
                }
            }
        }
        catch (err) {
            logger.error('automation_reminder_teacher_failed', {
                teacherId: teacher._id.toString(),
                error: err.message,
            });
        }
    }
    logger.info('automation_reminder_done', { totalReminders });
}
//# sourceMappingURL=automation.service.js.map