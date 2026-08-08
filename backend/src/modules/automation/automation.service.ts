import { UserModel }        from '../../database/models/user.model.js';
import { StudentModel }     from '../../database/models/student.model.js';
import { SessionModel }     from '../../database/models/session.model.js';
import { TransactionModel } from '../../database/models/transaction.model.js';
import { UserRole, SessionStatus, TransactionType, TransactionCategory }
    from '../../common/enums/enum.service.js';
import { enqueueEmail } from '../../infrastructure/queues/whatsapp.queue.js';
import { logger }           from '../../common/utils/logger.util.js';
import { startOfDayEgypt } from '../../common/utils/date.util.js';

// egyptToday: returns midnight UTC of today in Egypt timezone
function egyptToday(): Date {
    return startOfDayEgypt(new Date());
}

function formatDateAr(date: Date): string {
    return date.toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
}

// ─── Weekly Teacher Report ───────────────────────────────────────────────────
/**
 * Collects financial & session data for the past 7 days for every active
 * teacher and enqueues an email job for each.
 */
export async function generateWeeklyReports(teacherId?: string, forceTest: boolean = false): Promise<void> {
    const query: any = { role: UserRole.teacher, isActive: true };
    if (teacherId) query._id = teacherId;

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
    const weekEndStr   = formatDateAr(weekEnd);

    logger.info('automation_weekly_start', {
        count:     teachers.length,
        weekStart: weekStart.toISOString(),
        weekEnd:   weekEnd.toISOString(),
        forceTest,
    });

    let enqueued = 0;
    let skipped  = 0;

    for (const teacher of teachers) {
        try {
            const tid = teacher._id.toString();

            // Skip teachers without email
            if (!teacher.email) {
                logger.warn('automation_weekly_no_email', { teacherId: tid, teacherName: teacher.name });
                skipped++;
                continue;
            }

            logger.info('automation_weekly_processing_teacher', { teacherId: tid, teacherName: teacher.name });

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
            const expenseRent     = expenseMap.get(TransactionCategory.RENT) ?? 0;
            const expenseOther    = (expenseMap.get(TransactionCategory.SUPPLIES) ?? 0)
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
            const { StudentService } = await import('../students/students.service.js');
            const unpaidIds = await StudentService.getUnpaidStudentIds(teacher._id.toString());
            
            const totalStudents = await StudentModel.countDocuments({ teacherId: teacher._id, isActive: true });
            const unpaidStudents = unpaidIds.length;

            // ── Enqueue email ─────────────────────────────────────────────
            enqueueEmail({
                kind:                'weekly_teacher_report',
                teacherId:           tid,
                teacherName:         teacher.name,
                teacherEmail:        teacher.email,
                weekStart:           weekStartStr,
                weekEnd:             weekEndStr,
                incomeSubscriptions,
                incomeNotebooks,
                incomeOther,
                totalIncome,
                expenseSalaries,
                expenseRent,
                expenseOther,
                totalExpenses,
                netBalance:          totalIncome - totalExpenses,
                completedSessions,
                cancelledSessions,
                totalStudents,
                unpaidStudents,
            }, forceTest);

            enqueued++;
            logger.info('automation_weekly_teacher_enqueued', { teacherId: tid, email: teacher.email });
        } catch (err) {
            logger.error('automation_weekly_teacher_failed', {
                teacherId: teacher._id.toString(),
                error:     (err as Error).message,
                stack:     (err as Error).stack,
            });
        }
    }

    logger.info('automation_weekly_done', { total: teachers.length, enqueued, skipped });
}
