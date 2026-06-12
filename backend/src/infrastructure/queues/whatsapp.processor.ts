import { Worker, type Job } from 'bullmq';
import { envVars }               from '../../../config/env.service.js';
import { logger }                from '../../common/utils/logger.util.js';
import { sendWhatsAppMessage }   from '../../common/utils/whatsapp.service.js';
import type { WhatsAppJobData }  from './queue.types.js';

// ─── Rate-limit delay ─────────────────────────────────────────────────────────
// WhatsApp bans numbers that send messages too fast.
// 12 000 ms between messages ≈ 5 messages/minute — safe for automation.
const INTER_MESSAGE_DELAY_MS = 12_000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Payment reminder templates (randomized to reduce ban risk) ───────────────
const PAYMENT_REMINDER_TEMPLATES = [
    (s: string, t: string) =>
        `السلام عليكم ورحمة الله 🌙\n` +
        `نُذكركم بضرورة سداد المصاريف المستحقة للطالب/ة: *${s}* عن هذا الشهر.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,

    (s: string, t: string) =>
        `أهلاً بكم 🌺\n` +
        `نلفت انتباهكم إلى أن الطالب/ة: *${s}* لم يقم بتسديد اشتراك الشهر الحالي حتى الآن.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,

    (s: string, t: string) =>
        `تحية طيبة 🌟\n` +
        `رسالة تذكيرية بخصوص سداد اشتراك الشهر للطالب/ة: *${s}* لتأكيد الاستمرار.\n\n` +
        `لإيقاف هذه الرسائل، أرسل "إلغاء".\n\n` +
        `مع تحيات أ/ ${t}`,
];

// ─── Absence templates (randomized to reduce ban risk) ────────────────────────
const SESSION_ABSENT_TEMPLATES = [
    (s: string, g: string, d: string, t: string) =>
        `السلام عليكم ورحمة الله وبركاته 🌙\n\n` +
        `نُعلمكم بغياب الطالب/ة: *${s}*\n` +
        `عن حصة مجموعة: *${g}*\n` +
        `بتاريخ: ${d}\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لمتابعتكم 🙏`,

    (s: string, g: string, d: string, t: string) =>
        `أهلاً بكم \n\n` +
        `نلفت انتباهكم إلى أن الطالب/ة: *${s}*\n` +
        `لم يحضر/تحضر حصة اليوم (${d}) لمجموعة: *${g}*.\n\n` +
        `برجاء المتابعة، مع تحيات أ/ ${t}`,

    (s: string, g: string, d: string, t: string) =>
        `تحية طيبة 🌟\n\n` +
        `نود إبلاغكم بغياب الطالب/ة: *${s}*\n` +
        `عن حصة مجموعة: *${g}* بتاريخ ${d}.\n\n` +
        `نتمنى أن يكون المانع خيراً. مع تحيات أ/ ${t}`,
];

// ─── Exam Result templates (randomized to reduce ban risk) ────────────────────
const EXAM_RESULT_TEMPLATES = [
    (s: string, ex: string, d: string, score: number, total: number, perc: string, g: string, passLabel: string, t: string) =>
        `السلام عليكم ورحمة الله وبركاته \n\n` +
        `نتيجة امتحان: *${ex}*\n` +
        `الطالب/ة: *${s}*\n` +
        `التاريخ: ${d}\n\n` +
        `الدرجة: *${score} / ${total}* (${perc}%)\n` +
        `التقدير: *${g}* — ${passLabel}\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لمتابعتكم 🙏`,

    (s: string, ex: string, d: string, score: number, total: number, perc: string, g: string, passLabel: string, t: string) =>
        `أهلاً بكم \n\n` +
        `نرفق لكم نتيجة الطالب/ة: *${s}* في امتحان *${ex}* (${d}):\n\n` +
        `▪️ الدرجة: *${score} من ${total}*\n` +
        `▪️ النسبة: ${perc}%\n` +
        `▪️ التقدير العام: *${g}* (${passLabel})\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `بالتوفيق دائماً 🌟`,

    (s: string, ex: string, d: string, score: number, total: number, perc: string, g: string, passLabel: string, t: string) =>
        `تحية طيبة 🌟\n\n` +
        `تم رصد درجات امتحان *${ex}* بتاريخ ${d}.\n` +
        `حصل الطالب/ة: *${s}* على درجة *${score} / ${total}* (${perc}%).\n\n` +
        `مستوى الطالب: *${g}* (${passLabel})\n\n` +
        `مع تحيات أ/ ${t}\n` +
        `شكراً لتعاونكم.`,
];
// ─── Message builders ─────────────────────────────────────────────────────────
function buildMessage(data: WhatsAppJobData): string {
    if (data.kind === 'session_absent') {
        const date = new Date(data.sessionDate).toLocaleDateString('ar-EG', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const idx = Math.floor(Math.random() * SESSION_ABSENT_TEMPLATES.length);
        return SESSION_ABSENT_TEMPLATES[idx]!(data.studentName, data.groupName, date, data.teacherName);
    }

    if (data.kind === 'payment_reminder') {
        const idx = Math.floor(Math.random() * PAYMENT_REMINDER_TEMPLATES.length);
        return PAYMENT_REMINDER_TEMPLATES[idx]!(data.studentName, data.teacherName);
    }

    // kind === 'exam_result'
    const date = new Date(data.examDate).toLocaleDateString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric',
    });
    const passLabel = data.passed ? '✅ ناجح' : '❌ راسب';
    
    const idx = Math.floor(Math.random() * EXAM_RESULT_TEMPLATES.length);
    return EXAM_RESULT_TEMPLATES[idx]!(
        data.studentName, data.examTitle, date, 
        data.score, data.totalMarks, data.percentage.toString(), 
        data.grade, passLabel, data.teacherName || ''
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
 * concurrency: 1 — processes one job at a time so the 12 s delay actually
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
