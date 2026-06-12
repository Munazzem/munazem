import { Worker, type Job } from 'bullmq';
import { envVars }              from '../../../config/env.service.js';
import { logger }               from '../../common/utils/logger.util.js';
import { sendWeeklyReportEmail } from '../../common/utils/email.service.js';
import type { EmailJobData }    from './queue.types.js';

// ─── Processor ───────────────────────────────────────────────────────────────
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const data = job.data;

    logger.info('email_job_start', {
        jobId: job.id,
        kind:  data.kind,
        email: data.teacherEmail,
    });

    if (data.kind === 'weekly_teacher_report') {
        const sent = await sendWeeklyReportEmail({
            teacherName:         data.teacherName,
            teacherEmail:        data.teacherEmail,
            weekStart:           data.weekStart,
            weekEnd:             data.weekEnd,
            incomeSubscriptions: data.incomeSubscriptions,
            incomeNotebooks:     data.incomeNotebooks,
            incomeOther:         data.incomeOther,
            totalIncome:         data.totalIncome,
            expenseSalaries:     data.expenseSalaries,
            expenseRent:         data.expenseRent,
            expenseOther:        data.expenseOther,
            totalExpenses:       data.totalExpenses,
            netBalance:          data.netBalance,
            completedSessions:   data.completedSessions,
            cancelledSessions:   data.cancelledSessions,
            totalStudents:       data.totalStudents,
            unpaidStudents:      data.unpaidStudents,
        });

        if (!sent) {
            throw new Error('Email delivery failed — will be retried by BullMQ');
        }
    }

    logger.info('email_job_done', { jobId: job.id, kind: data.kind });
}

// ─── Worker factory ──────────────────────────────────────────────────────────
/**
 * Creates and starts the BullMQ Worker for email jobs.
 * concurrency: 2 — emails are independent and fast, no ban risk.
 */
export function startEmailWorker(): Worker<EmailJobData> {
    const worker = new Worker<EmailJobData>(
        'email',
        processEmailJob,
        {
            connection: { url: envVars.redisUrl },
            concurrency: 2,
        },
    );

    worker.on('failed', (job, err) => {
        logger.error('email_job_failed', {
            jobId: job?.id,
            kind:  job?.data?.kind,
            error: err.message,
        });
    });

    worker.on('error', (err) => {
        logger.error('email_worker_error', { error: err.message });
    });

    logger.info('email_worker_started', { concurrency: 2 });
    return worker;
}
