import { Worker, DelayedError } from 'bullmq';
import { envVars } from '../../../config/env.service.js';
import { Redis } from 'ioredis';
import { logger } from '../../common/utils/logger.util.js';
import { sendWhatsAppMessage } from '../../common/utils/whatsapp.service.js';
// ─── Rate-limit delay ─────────────────────────────────────────────────────────
// WhatsApp bans numbers that send messages too fast.
// 12 000 ms between messages ≈ 5 messages/minute — safe for automation.
const INTER_MESSAGE_DELAY_MS = 12_000;
// Redis client for teacher-specific rate limiting (locks)
const redis = new Redis(envVars.redisUrl);
// ─── Payment reminder templates (randomized to reduce ban risk) ───────────────
const PAYMENT_REMINDER_TEMPLATES = [
    (s, t) => `السلام عليكم ورحمة الله 🌙\n` +
        `نُذكركم بضرورة سداد المصاريف المستحقة للطالب/ة: *${s}* عن هذا الشهر.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,
    (s, t) => `أهلاً بكم 🌺\n` +
        `نلفت انتباهكم إلى أن الطالب/ة: *${s}* لم يقم بتسديد اشتراك الشهر الحالي حتى الآن.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,
    (s, t) => `تحية طيبة 🌟\n` +
        `رسالة تذكيرية بخصوص سداد اشتراك الشهر للطالب/ة: *${s}* لتأكيد الاستمرار.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,
];
// ─── Absence templates (randomized to reduce ban risk) ────────────────────────
const SESSION_ABSENT_TEMPLATES = [
    (s, g, d, t) => `السلام عليكم ورحمة الله وبركاته 🌙\n\n` +
        `نُعلمكم بغياب الطالب/ة: *${s}*\n` +
        `عن حصة مجموعة: *${g}*\n` +
        `بتاريخ: ${d}\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لمتابعتكم 🙏`,
    (s, g, d, t) => `أهلاً بكم \n\n` +
        `نلفت انتباهكم إلى أن الطالب/ة: *${s}*\n` +
        `لم يحضر/تحضر حصة اليوم (${d}) لمجموعة: *${g}*.\n\n` +
        `برجاء المتابعة، مع تحيات أ/ ${t}`,
    (s, g, d, t) => `تحية طيبة 🌟\n\n` +
        `نود إبلاغكم بغياب الطالب/ة: *${s}*\n` +
        `عن حصة مجموعة: *${g}* بتاريخ ${d}.\n\n` +
        `نتمنى أن يكون المانع خيراً. مع تحيات أ/ ${t}`,
];
// ─── Exam Result templates (randomized to reduce ban risk) ────────────────────
const EXAM_RESULT_TEMPLATES = [
    (s, ex, d, score, total, perc, g, passLabel, t) => `السلام عليكم ورحمة الله وبركاته \n\n` +
        `نتيجة امتحان: *${ex}*\n` +
        `الطالب/ة: *${s}*\n` +
        `التاريخ: ${d}\n\n` +
        `الدرجة: *${score} / ${total}* (${perc}%)\n` +
        `التقدير: *${g}* — ${passLabel}\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لمتابعتكم 🙏`,
    (s, ex, d, score, total, perc, g, passLabel, t) => `أهلاً بكم \n\n` +
        `نرفق لكم نتيجة الطالب/ة: *${s}* في امتحان *${ex}* (${d}):\n\n` +
        `▪️ الدرجة: *${score} من ${total}*\n` +
        `▪️ النسبة: ${perc}%\n` +
        `▪️ التقدير العام: *${g}* (${passLabel})\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `بالتوفيق دائماً 🌟`,
    (s, ex, d, score, total, perc, g, passLabel, t) => `تحية طيبة 🌟\n\n` +
        `تم رصد درجات امتحان *${ex}* بتاريخ ${d}.\n` +
        `حصل الطالب/ة: *${s}* على درجة *${score} / ${total}* (${perc}%).\n\n` +
        `مستوى الطالب: *${g}* (${passLabel})\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لتعاونكم.`,
];
// ─── Message builders ─────────────────────────────────────────────────────────
function buildMessage(data) {
    if (data.kind === 'session_absent') {
        const date = new Date(data.sessionDate).toLocaleDateString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const idx = Math.floor(Math.random() * SESSION_ABSENT_TEMPLATES.length);
        return SESSION_ABSENT_TEMPLATES[idx](data.studentName, data.groupName, date, data.teacherName);
    }
    if (data.kind === 'payment_reminder') {
        const idx = Math.floor(Math.random() * PAYMENT_REMINDER_TEMPLATES.length);
        return PAYMENT_REMINDER_TEMPLATES[idx](data.studentName, data.teacherName);
    }
    // kind === 'exam_result'
    const date = new Date(data.examDate).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const passLabel = data.passed ? '✅ ناجح' : '❌ راسب';
    const idx = Math.floor(Math.random() * EXAM_RESULT_TEMPLATES.length);
    return EXAM_RESULT_TEMPLATES[idx](data.studentName, data.examTitle, date, data.score, data.totalMarks, data.percentage.toString(), data.grade, passLabel, data.teacherName || '');
}
// ─── Processor function ───────────────────────────────────────────────────────
async function processWhatsAppJob(job) {
    const data = job.data;
    const lockKey = `whatsapp:lock:${data.teacherId}`;
    // ── Multi-Tenant Rate Limiting (Redis Lock) ─────────────────────────────
    // Try to acquire a lock for this specific teacher for 12 seconds.
    // NX = Only set if not exists, PX = Expire in milliseconds
    const acquired = await redis.set(lockKey, '1', 'PX', INTER_MESSAGE_DELAY_MS, 'NX');
    if (!acquired) {
        // Teacher sent a message recently. Delay this job for 12 seconds.
        // job.token is required by BullMQ v3+ for moveToDelayed
        await job.moveToDelayed(Date.now() + INTER_MESSAGE_DELAY_MS, job.token);
        throw new DelayedError();
    }
    logger.info('whatsapp_job_start', {
        jobId: job.id,
        kind: data.kind,
        phone: data.parentPhone,
        attempt: job.attemptsMade + 1,
    });
    const message = buildMessage(data);
    await sendWhatsAppMessage(data.parentPhone, message, data.teacherId);
    logger.info('whatsapp_job_done', { jobId: job.id, kind: data.kind });
}
// ─── Worker factory ───────────────────────────────────────────────────────────
/**
 * Creates and starts the BullMQ Worker.
 * Call this once from `bootstrap()` in app.controller.ts.
 *
 * concurrency: 50 — allows processing multiple messages simultaneously.
 * The Redis Lock inside processWhatsAppJob ensures that messages from the
 * SAME teacher are spaced by 12 seconds, while different teachers run in parallel.
 */
export function startWhatsAppWorker() {
    const worker = new Worker('whatsapp', processWhatsAppJob, {
        connection: { url: envVars.redisUrl },
        concurrency: 50, // Process up to 50 jobs concurrently
    });
    worker.on('failed', (job, err) => {
        logger.error('whatsapp_job_failed', {
            jobId: job?.id,
            kind: job?.data?.kind,
            attempt: job?.attemptsMade,
            error: err.message,
        });
    });
    worker.on('error', (err) => {
        logger.error('whatsapp_worker_error', { error: err.message });
    });
    logger.info('whatsapp_worker_started', { concurrency: 50, delayMs: INTER_MESSAGE_DELAY_MS });
    return worker;
}
//# sourceMappingURL=whatsapp.processor.js.map