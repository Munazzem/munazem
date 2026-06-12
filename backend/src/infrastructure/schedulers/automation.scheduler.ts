import { Queue } from 'bullmq';
import { envVars } from '../../../config/env.service.js';
import { logger }  from '../../common/utils/logger.util.js';
import { generateWeeklyReports, generatePaymentReminders }
    from '../../modules/automation/automation.service.js';
import { archiveOldData } from '../../scripts/archive-old-data.js';
import { Worker } from 'bullmq';

// ─── Automation Queue ────────────────────────────────────────────────────────
// A dedicated queue for scheduled automation tasks.
// BullMQ "repeatable jobs" act as cron triggers — each fires a lightweight job
// whose processor calls the real data-gathering function.

const connection = { url: envVars.redisUrl };

const automationQueue = new Queue('automation', {
    connection,
    defaultJobOptions: {
        attempts:         1,       // no retry — if it fails, wait for next cron tick
        removeOnComplete: { count: 50 },
        removeOnFail:     { count: 100 },
    },
});

// ─── Schedule definitions ────────────────────────────────────────────────────
// Cron expressions are in UTC.
// Egypt is UTC+2 (winter) / UTC+3 (summer). We use UTC+3 as a safe default.
//
//  ┌──────────── min (0–59)
//  │ ┌────────── hour (0–23, UTC)
//  │ │ ┌──────── day of month (1–31)
//  │ │ │ ┌────── month (1–12)
//  │ │ │ │ ┌──── day of week (0–7, 0=Sun, 4=Thu)
//  │ │ │ │ │
//  0 18 * * 4   →  every Thursday at 18:00 UTC = 21:00 (9 PM) Egypt
//  0 10 * * *   →  every day at 10:00 UTC = 13:00 (1 PM) Egypt

const SCHEDULES = [
    {
        name:    'weekly_teacher_report',
        pattern: '0 18 * * 4',   // Thursday 9 PM Egypt
    },
    {
        name:    'daily_payment_reminder',
        pattern: '0 10 * * *',   // Daily 1 PM Egypt (check if tomorrow is 2nd session day)
    },
    {
        name:    'weekly_data_archive',
        pattern: '0 0 * * 6',    // Saturday 3 AM Egypt (00:00 UTC)
    },
];

// ─── Processor ───────────────────────────────────────────────────────────────
async function processAutomationJob(job: any): Promise<void> {
    logger.info('automation_job_start', { name: job.name });

    switch (job.name) {
        case 'weekly_teacher_report':
            await generateWeeklyReports();
            break;

        case 'daily_payment_reminder':
            await generatePaymentReminders();
            break;

        case 'weekly_data_archive':
            await archiveOldData();
            break;

        default:
            logger.warn('automation_unknown_job', { name: job.name });
    }

    logger.info('automation_job_done', { name: job.name });
}

// ─── Start scheduler ─────────────────────────────────────────────────────────
/**
 * Registers repeatable (cron) jobs in BullMQ and starts a Worker to process
 * them.  Call this once from `bootstrap()` in app.controller.ts.
 *
 * BullMQ stores repeatable job definitions in Redis, so they survive server
 * restarts.  `upsertJobScheduler` ensures no duplicates.
 */
export async function startAutomationScheduler(): Promise<void> {
    // Register repeatable jobs
    for (const schedule of SCHEDULES) {
        await automationQueue.upsertJobScheduler(
            schedule.name,
            { pattern: schedule.pattern },
            { name: schedule.name },
        );

        logger.info('automation_schedule_registered', {
            name:    schedule.name,
            pattern: schedule.pattern,
        });
    }

    // Start worker
    const worker = new Worker(
        'automation',
        processAutomationJob,
        { connection, concurrency: 1 },
    );

    worker.on('failed', (job, err) => {
        logger.error('automation_job_failed', {
            name:  job?.name,
            error: err.message,
        });
    });

    worker.on('error', (err) => {
        logger.error('automation_worker_error', { error: err.message });
    });

    logger.info('automation_scheduler_started', {
        schedules: SCHEDULES.map(s => `${s.name} (${s.pattern})`),
    });
}
