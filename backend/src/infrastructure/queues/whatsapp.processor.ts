import { Worker, type Job } from 'bullmq';
import { envVars }               from '../../../config/env.service.js';
import { logger }                from '../../common/utils/logger.util.js';
import { sendWhatsAppMessage }   from '../../common/utils/whatsapp.service.js';
import type { WhatsAppJobData }  from './queue.types.js';

// ─── Rate-limit delay ─────────────────────────────────────────────────────────
// WhatsApp bans numbers that send messages too fast.
// 4 000 ms between messages ≈ 15 messages/minute — safe for most gateways.
const INTER_MESSAGE_DELAY_MS = 4_000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Message builders ─────────────────────────────────────────────────────────
function buildMessage(data: WhatsAppJobData): string {
    if (data.kind === 'session_absent') {
        const date = new Date(data.sessionDate).toLocaleDateString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        return (
            `السلام عليكم ورحمة الله وبركاته 🌙\n\n` +
            `نُعلمكم بغياب الطالب/ة: *${data.studentName}*\n` +
            `عن حصة مجموعة: *${data.groupName}*\n` +
            `بتاريخ: ${date}\n\n` +
            `للتواصل: ${data.teacherName}\n` +
            `شكراً لمتابعتكم 🙏`
        );
    }

    // kind === 'exam_result'
    const date = new Date(data.examDate).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const passLabel = data.passed ? '✅ ناجح' : '❌ راسب';
    return (
        `السلام عليكم ورحمة الله وبركاته 🌙\n\n` +
        `نتيجة امتحان: *${data.examTitle}*\n` +
        `الطالب/ة: *${data.studentName}*\n` +
        `التاريخ: ${date}\n\n` +
        `الدرجة: *${data.score} / ${data.totalMarks}* (${data.percentage}%)\n` +
        `التقدير: *${data.grade}* — ${passLabel}\n\n` +
        `شكراً لمتابعتكم 🙏`
    );
}

// ─── Processor function ───────────────────────────────────────────────────────
async function processWhatsAppJob(job: Job<WhatsAppJobData>): Promise<void> {
    const data = job.data;

    logger.info('whatsapp_job_start', {
        jobId: job.id,
        kind:  data.kind,
        phone: data.parentPhone,
        attempt: job.attemptsMade + 1,
    });

    const message = buildMessage(data);
    await sendWhatsAppMessage(data.parentPhone, message, data.teacherId);

    // ── Rate-limit delay ──────────────────────────────────────────────────────
    // Sleep AFTER sending so the delay is between outgoing messages,
    // not added before the first one (which would feel slow to the user).
    await sleep(INTER_MESSAGE_DELAY_MS);

    logger.info('whatsapp_job_done', { jobId: job.id, kind: data.kind });
}

// ─── Worker factory ───────────────────────────────────────────────────────────
/**
 * Creates and starts the BullMQ Worker.
 * Call this once from `bootstrap()` in app.controller.ts.
 *
 * concurrency: 1 — processes one job at a time so the 4 s delay actually
 * enforces a gap between messages (higher concurrency would bypass it).
 */
export function startWhatsAppWorker(): Worker<WhatsAppJobData> {
    const worker = new Worker<WhatsAppJobData>(
        'whatsapp',
        processWhatsAppJob,
        {
            connection: { url: envVars.redisUrl },
            concurrency: 1,
        },
    );

    worker.on('failed', (job, err) => {
        logger.error('whatsapp_job_failed', {
            jobId:   job?.id,
            kind:    job?.data?.kind,
            attempt: job?.attemptsMade,
            error:   err.message,
        });
    });

    worker.on('error', (err) => {
        logger.error('whatsapp_worker_error', { error: err.message });
    });

    logger.info('whatsapp_worker_started', { concurrency: 1, delayMs: INTER_MESSAGE_DELAY_MS });
    return worker;
}
