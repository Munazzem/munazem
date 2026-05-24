import { Queue } from 'bullmq';
import { envVars } from '../../../config/env.service.js';
import { logger }  from '../../common/utils/logger.util.js';
import type { WhatsAppJobData } from './queue.types.js';

// ─── Redis connection options ─────────────────────────────────────────────────
// BullMQ accepts a full ioredis connection string via `connection.url`
const connection = { url: envVars.redisUrl };

// ─── Singleton Queue ──────────────────────────────────────────────────────────
// One Queue instance is enough — it only pushes jobs, not processes them.
export const whatsAppQueue = new Queue<WhatsAppJobData>('whatsapp', {
    connection,
    defaultJobOptions: {
        attempts:    3,          // retry up to 3 times on gateway error
        backoff: {
            type:  'exponential',
            delay: 5_000,        // first retry after 5 s, then 10 s, 20 s …
        },
        removeOnComplete: { count: 200 },  // keep last 200 completed jobs for audit
        removeOnFail:     { count: 500 },  // keep last 500 failed jobs for debugging
    },
});

// ─── Typed enqueue helper ─────────────────────────────────────────────────────
/**
 * Add a single WhatsApp notification job to the queue.
 * Fire-and-forget — logs a warning on failure but never throws.
 * Callers (completeSession, batchRecordResults) must not be blocked by this.
 */
export function enqueueWhatsApp(data: WhatsAppJobData): void {
    whatsAppQueue
        .add(data.kind, data, {
            // Spread a unique deduplication key so re-calling completeSession
            // after a crash doesn't send the same WhatsApp twice.
            jobId: buildJobId(data),
        })
        .catch((err) => {
            logger.warn('whatsapp_queue_enqueue_failed', {
                kind:  data.kind,
                phone: data.parentPhone,
                error: (err as Error).message,
            });
        });
}

// ─── Deduplication key ────────────────────────────────────────────────────────
function buildJobId(data: WhatsAppJobData): string {
    if (data.kind === 'session_absent') {
        // One job per teacher per student per session day
        return `absent-${data.teacherId}-${data.parentPhone}-${data.sessionDate.slice(0, 10)}`;
    }
    // One job per teacher per student per exam
    return `exam-${data.teacherId}-${data.parentPhone}-${data.examDate.slice(0, 10)}-${data.examTitle}`;
}
