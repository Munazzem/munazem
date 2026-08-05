import mongoose from 'mongoose';
import { Queue } from 'bullmq';
import { envVars } from '../../../config/env.service.js';
import { logger }  from '../../common/utils/logger.util.js';
import { isTeacherPremium } from '../../common/utils/premium.util.js';
import { MessageLogModel } from '../../database/models/message-log.model.js';
import type { WhatsAppJobData, EmailJobData } from './queue.types.js';

// ─── Redis connection options ─────────────────────────────────────────────────
const connection = { url: envVars.redisUrl };

// ─── WhatsApp Queue (Singleton) ───────────────────────────────────────────────
export const whatsAppQueue = new Queue<WhatsAppJobData>('whatsapp', {
    connection,
    defaultJobOptions: {
        attempts:    3,
        backoff: {
            type:  'exponential',
            delay: 5_000,
        },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 500 },
    },
});

// ─── Email Queue (Singleton) ─────────────────────────────────────────────────
export const emailQueue = new Queue<EmailJobData>('email', {
    connection,
    defaultJobOptions: {
        attempts:    2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 200 },
    },
});

// ─── Typed enqueue helper (WhatsApp) ─────────────────────────────────────────
/**
 * Add a WhatsApp notification job to the queue.
 *
 * **Premium Gate (Single Source of Truth):**
 * Only teachers with an active Premium subscription can send WhatsApp messages.
 * This check runs here — BEFORE any Job, MessageLog, or metric is created.
 * No other code path should bypass this function.
 *
 * **MessageLog:** Creates a persistent DB record for every enqueued message
 * so the admin dashboard always has a complete history.
 */
export async function enqueueWhatsApp(data: WhatsAppJobData): Promise<void> {
    // ── 1. Premium Gate — non-Premium teachers are silently skipped ───────
    const isPremium = await isTeacherPremium(data.teacherId);
    if (!isPremium) {
        logger.info('whatsapp_skipped_not_premium', {
            teacherId: data.teacherId,
            kind:      data.kind,
        });
        return; // Early return — no job, no log, nothing
    }

    const jobId = buildWhatsAppJobId(data);

    // ── 2. Create persistent MessageLog entry ────────────────────────────
    let messageLogId: string | undefined;
    try {
        const studentIdValue = 'studentId' in data ? data.studentId : undefined;
        const log = await MessageLogModel.create({
            teacherId:   new mongoose.Types.ObjectId(data.teacherId),
            studentId:   studentIdValue ? new mongoose.Types.ObjectId(studentIdValue) : undefined,
            parentPhone: data.parentPhone,
            kind:        data.kind,
            status:      'queued',
            jobId,
        });
        messageLogId = (log._id as any).toString();
    } catch (err) {
        // MessageLog creation failure should NOT prevent message sending
        logger.warn('message_log_create_failed', {
            kind:  data.kind,
            error: (err as Error).message,
        });
    }

    // ── 3. Enqueue in BullMQ ─────────────────────────────────────────────
    try {
        await whatsAppQueue.add(data.kind, data, { jobId });
    } catch (err) {
        logger.error('whatsapp_queue_enqueue_failed', {
            kind:  data.kind,
            phone: data.parentPhone,
            error: (err as Error).message,
        });
        // Update MessageLog to reflect enqueue failure
        if (messageLogId) {
            MessageLogModel.updateOne(
                { _id: messageLogId },
                { status: 'failed', failReason: `Enqueue failed: ${(err as Error).message}` },
            ).catch(() => {});
        }
    }
}

// ─── Typed enqueue helper (Email) ────────────────────────────────────────────
export function enqueueEmail(data: EmailJobData, forceTest: boolean = false): void {
    const jobId = forceTest
        ? `report-${data.teacherId}-${data.weekStart}-${Date.now()}`
        : `report-${data.teacherId}-${data.weekStart}`;

    emailQueue
        .add(data.kind, data, { jobId })
        .catch((err) => {
            logger.warn('email_queue_enqueue_failed', {
                kind:  data.kind,
                email: data.teacherEmail,
                error: (err as Error).message,
            });
        });
}

// ─── Deduplication key (WhatsApp) ─────────────────────────────────────────────
function buildWhatsAppJobId(data: WhatsAppJobData): string {
    if (data.kind === 'session_absent') {
        return `absent-${data.teacherId}-${data.studentId}-${data.sessionDate.slice(0, 10)}`;
    }
    // kind === 'exam_result'
    return `exam-${data.teacherId}-${data.parentPhone}-${data.examDate.slice(0, 10)}-${data.examTitle}`;
}
