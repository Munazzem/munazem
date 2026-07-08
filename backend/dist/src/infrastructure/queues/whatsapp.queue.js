import { Queue } from 'bullmq';
import { envVars } from '../../../config/env.service.js';
import { logger } from '../../common/utils/logger.util.js';
// ─── Redis connection options ─────────────────────────────────────────────────
// BullMQ accepts a full ioredis connection string via `connection.url`
const connection = { url: envVars.redisUrl };
// ─── WhatsApp Queue (Singleton) ───────────────────────────────────────────────
// One Queue instance is enough — it only pushes jobs, not processes them.
export const whatsAppQueue = new Queue('whatsapp', {
    connection,
    defaultJobOptions: {
        attempts: 3, // retry up to 3 times on gateway error
        backoff: {
            type: 'exponential',
            delay: 5_000, // first retry after 5 s, then 10 s, 20 s …
        },
        removeOnComplete: { count: 200 }, // keep last 200 completed jobs for audit
        removeOnFail: { count: 500 }, // keep last 500 failed jobs for debugging
    },
});
// ─── Email Queue (Singleton) ─────────────────────────────────────────────────
export const emailQueue = new Queue('email', {
    connection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});
// ─── Typed enqueue helper (WhatsApp) ─────────────────────────────────────────
/**
 * Add a single WhatsApp notification job to the queue.
 * Fire-and-forget — logs a warning on failure but never throws.
 * Callers (completeSession, batchRecordResults) must not be blocked by this.
 */
export function enqueueWhatsApp(data) {
    whatsAppQueue
        .add(data.kind, data, {
        // Spread a unique deduplication key so re-calling completeSession
        // after a crash doesn't send the same WhatsApp twice.
        jobId: buildWhatsAppJobId(data),
    })
        .catch((err) => {
        logger.warn('whatsapp_queue_enqueue_failed', {
            kind: data.kind,
            phone: data.parentPhone,
            error: err.message,
        });
    });
}
// ─── Typed enqueue helper (Email) ────────────────────────────────────────────
export function enqueueEmail(data, forceTest = false) {
    const jobId = forceTest
        ? `report-${data.teacherId}-${data.weekStart}-${Date.now()}`
        : `report-${data.teacherId}-${data.weekStart}`;
    emailQueue
        .add(data.kind, data, { jobId })
        .catch((err) => {
        logger.warn('email_queue_enqueue_failed', {
            kind: data.kind,
            email: data.teacherEmail,
            error: err.message,
        });
    });
}
// ─── Deduplication key (WhatsApp) ─────────────────────────────────────────────
function buildWhatsAppJobId(data) {
    if (data.kind === 'session_absent') {
        // One job per teacher per STUDENT per session day.
        // Using studentId (not parentPhone) prevents siblings from deduplicating
        // each other when they share the same parent phone number.
        return `absent-${data.teacherId}-${data.studentId}-${data.sessionDate.slice(0, 10)}`;
    }
    if (data.kind === 'payment_reminder') {
        // One reminder per teacher per parent phone per month
        const month = new Date().toISOString().slice(0, 7); // "2026-05"
        return `reminder-${data.teacherId}-${data.parentPhone}-${month}`;
    }
    // kind === 'exam_result'
    return `exam-${data.teacherId}-${data.parentPhone}-${data.examDate.slice(0, 10)}-${data.examTitle}`;
}
//# sourceMappingURL=whatsapp.queue.js.map