import { Worker, type Job, DelayedError } from 'bullmq';
import { envVars }               from '../../../config/env.service.js';
import { Redis }                 from 'ioredis';
import { logger }                from '../../common/utils/logger.util.js';
import { sendWhatsAppMessage }   from '../../common/utils/whatsapp.service.js';
import { getWhatsAppGateway }    from '../socket/whatsapp.gateway.js';
import { MessageLogModel }       from '../../database/models/message-log.model.js';
import { PhoneGuard }            from '../../common/utils/phone-guard.util.js';
import { checkPhoneRegistration } from '../../common/utils/whatsapp.service.js';
import type { WhatsAppJobData }  from './queue.types.js';
import { pickTemplate } from './whatsapp.templates.js';

// ─── Configurable values ─────────────────────────────────────────────────────
const INTER_MESSAGE_DELAY_MS = parseInt(process.env.WA_INTER_MESSAGE_DELAY_MS ?? '12000');
const WORKER_CONCURRENCY     = parseInt(process.env.WA_WORKER_CONCURRENCY ?? '50');

// Redis client for teacher-specific rate limiting (locks)
const redis = new Redis(envVars.redisUrl);

// ─── Message builder ─────────────────────────────────────────────────────────
async function buildMessage(data: WhatsAppJobData): Promise<{ message: string; templateIdx: number }> {
    if (data.kind === 'session_absent') {
        const date = new Date(data.sessionDate).toLocaleDateString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const replacements = {
            studentName: data.studentName,
            sessionTitle: data.groupName,
            date: date,
            teacherName: data.teacherName || '',
        };
        const { text, templateIdx } = await pickTemplate('session_absent', replacements);
        return { message: text, templateIdx };
    }

    // kind === 'exam_result'
    const date = new Date(data.examDate).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const passLabel = data.passed ? '✅ ناجح' : '❌ راسب';
    const replacements = {
        studentName: data.studentName,
        examName: data.examTitle,
        date: date,
        studentScore: String(data.score),
        examTotal: String(data.totalMarks),
        percentage: String(data.percentage),
        grade: String(data.grade),
        passLabel: passLabel,
        teacherName: data.teacherName || '',
    };
    const { text, templateIdx } = await pickTemplate('exam_result', replacements);
    return { message: text, templateIdx };
}

// ─── Processor function ───────────────────────────────────────────────────────
export async function processWhatsAppJob(job: Job<WhatsAppJobData>): Promise<void> {
    const data = job.data;
    const lockKey = `whatsapp:lock:${data.teacherId}`;

    // Fast-fail if missing data
    if (!data.teacherId || !data.parentPhone || !data.kind) {
        throw new Error('Missing required fields (teacherId, parentPhone, kind) in job data');
    }

    // ── 0. Guard: Check Cache & DB for phone status ──
    const phoneStatus = await PhoneGuard.getStatus(data.teacherId, data.parentPhone);
    if (phoneStatus === 'invalid' || phoneStatus === 'blocked') {
        // Stop retries, mark as failed permanently
        if (job.id) {
            await MessageLogModel.updateOne(
                { jobId: job.id },
                { $set: { status: phoneStatus === 'invalid' ? 'not_registered' : 'blocked', failReason: phoneStatus } }
            );
        }
        logger.info(`whatsapp_skipped_${phoneStatus}`, { phone: data.parentPhone, teacherId: data.teacherId });
        return; // Success return, so BullMQ doesn't retry
    }

    // ── Multi-Tenant Rate Limiting (Redis Lock) ─────────────────────────────
    const acquired = await redis.set(lockKey, '1', 'PX', INTER_MESSAGE_DELAY_MS, 'NX');

    if (!acquired) {
        await job.moveToDelayed(Date.now() + INTER_MESSAGE_DELAY_MS, job.token);
        throw new DelayedError();
    }

    try {
        logger.info('whatsapp_job_start', {
            jobId:   job.id,
            kind:    data.kind,
            phone:   data.parentPhone,
            attempt: job.attemptsMade + 1,
        });

        // ── 1. Guard: Check if actually registered if status is unknown ──
        if (!phoneStatus) {
            const isRegistered = await checkPhoneRegistration(data.teacherId, data.parentPhone);
            if (!isRegistered) {
                await PhoneGuard.setStatus(data.teacherId, data.parentPhone, 'invalid');
                if (job.id) {
                    await MessageLogModel.updateOne(
                        { jobId: job.id },
                        { $set: { status: 'not_registered', failReason: 'invalid_number' } }
                    );
                }
                return; // Stop and don't throw (no retry)
            } else {
                await PhoneGuard.setStatus(data.teacherId, data.parentPhone, 'valid');
            }
        }

        // ── 2. Send Message ──
        const { message, templateIdx } = await buildMessage(data);

        await sendWhatsAppMessage(data.parentPhone, message, data.teacherId);

        // Log Success
        if (job.id) {
            await MessageLogModel.updateOne(
                { jobId: job.id },
                { $set: { status: 'sent', sentAt: new Date(), attempts: job.attemptsMade + 1, templateIdx } }
            );
        }

        logger.info('whatsapp_job_done', { jobId: job.id, phone: data.parentPhone });
    } catch (err: any) {
        // Check if the error is a block
        if (err.message && err.message.startsWith('BLOCKED:')) {
            await PhoneGuard.setStatus(data.teacherId, data.parentPhone, 'blocked');
            if (job.id) {
                await MessageLogModel.updateOne(
                    { jobId: job.id },
                    { $set: { status: 'blocked', failReason: 'blocked_by_user', attempts: job.attemptsMade + 1 } }
                );
            }
            return; // Do NOT throw, we don't want retries on blocks
        }
        throw err; // Will trigger BullMQ retry
    }
}

// ─── Worker factory ───────────────────────────────────────────────────────────
/**
 * Creates and starts the BullMQ Worker.
 *
 * Uses BullMQ built-in rate limiter with `groupKey: 'teacherId'` — this replaces
 * the manual Redis Lock approach. Each teacher is rate-limited to 1 message per
 * INTER_MESSAGE_DELAY_MS (default 12s), while different teachers process in parallel.
 *
 * Benefits over the old Redis Lock approach:
 * - No separate Redis client needed
 * - No `DelayedError` hacks — BullMQ handles delays internally
 * - Delays don't count as failed attempts
 * - Cleaner, more reliable rate limiting
 */
export function startWhatsAppWorker(): Worker<WhatsAppJobData> {
    const worker = new Worker<WhatsAppJobData>(
        'whatsapp',
        processWhatsAppJob,
        {
            connection: { url: envVars.redisUrl },
            concurrency: WORKER_CONCURRENCY,
        },
    );

    worker.on('completed', (_job) => {
        getWhatsAppGateway().emitToSuperAdmins('wa:queue:updated', {});
    });

    worker.on('failed', (job, err) => {
        logger.error('whatsapp_job_failed', {
            jobId:   job?.id,
            kind:    job?.data?.kind,
            attempt: job?.attemptsMade,
            error:   err.message,
        });

        // Update MessageLog → failed (only on final failure)
        if (job && job.id && job.attemptsMade >= 3) {
            MessageLogModel.updateOne(
                { jobId: job.id },
                { status: 'failed', failReason: err.message, attempts: job.attemptsMade },
            ).catch(() => {});
        }

        getWhatsAppGateway().emitToSuperAdmins('wa:queue:updated', {});
    });

    worker.on('error', (err) => {
        logger.error('whatsapp_worker_error', { error: err.message });
    });

    logger.info('whatsapp_worker_started', {
        concurrency: WORKER_CONCURRENCY,
        delayMs:     INTER_MESSAGE_DELAY_MS,
        rateLimiter: 'Manual Redis Lock (per teacherId)',
    });
    return worker;
}
