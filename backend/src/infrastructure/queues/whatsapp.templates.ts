import { cache } from '../cache/cache.service.js';
import { PlatformSettingsModel } from '../../database/models/platform-settings.model.js';
import { logger } from '../../common/utils/logger.util.js';

// ── Default Fallback Templates (No Emojis except ⚠️) ──
export const DEFAULT_SESSION_ABSENT_TEMPLATES = [
    '⚠️ تنبيه: تم تسجيل غياب الطالب {studentName} عن الحصة ({sessionTitle}). يرجى المتابعة.',
    '⚠️ إشعار غياب: الطالب {studentName} لم يحضر حصة ({sessionTitle}) اليوم.',
    '⚠️ نود إعلامكم بغياب الطالب {studentName} عن الدرس ({sessionTitle}).',
    '⚠️ عذراً، لم يسجل الطالب {studentName} حضوراً في حصة ({sessionTitle}).',
    '⚠️ نلفت انتباهكم لغياب {studentName} عن حصة ({sessionTitle}).',
    '⚠️ رسالة تنبيهية: غاب الطالب {studentName} عن الحصة المجدولة ({sessionTitle}).',
];

export const DEFAULT_EXAM_RESULT_TEMPLATES = [
    '⚠️ إشعار نتيجة: حصل الطالب {studentName} على درجة {studentScore}/{examTotal} في امتحان ({examName}).',
    '⚠️ نتيجة الطالب {studentName} في اختبار ({examName}) هي {studentScore}/{examTotal}.',
    '⚠️ نعلمكم أن درجة {studentName} في امتحان ({examName}) كانت {studentScore}/{examTotal}.',
    '⚠️ تقرير درجة: أحرز الطالب {studentName} {studentScore}/{examTotal} في اختبار ({examName}).',
    '⚠️ تم رصد نتيجة {studentName} في امتحان ({examName}) وهي {studentScore}/{examTotal}.',
    '⚠️ نلفت انتباهكم إلى أن الطالب {studentName} نال {studentScore}/{examTotal} في ({examName}).',
];

const CACHE_KEY = 'whatsapp_dynamic_templates';
const CACHE_TTL = 3600; // 1 hour

export interface WhatsAppTemplates {
    session_absent: string[];
    exam_result: string[];
}

/**
 * Fetch templates from PlatformSettings (or cache).
 * Falls back to DEFAULT templates if not set in DB.
 */
export async function getWhatsAppTemplates(): Promise<WhatsAppTemplates> {
    const cached = await cache.get<WhatsAppTemplates>(CACHE_KEY);
    if (cached) return cached;

    try {
        const doc = await PlatformSettingsModel.findOne({ key: 'whatsapp_templates' }).lean();
        if (doc && doc.value) {
            const templates = doc.value as WhatsAppTemplates;
            // Validate structure briefly
            if (Array.isArray(templates.session_absent) && Array.isArray(templates.exam_result)) {
                await cache.set(CACHE_KEY, templates, CACHE_TTL);
                return templates;
            }
        }
    } catch (err) {
        logger.error('whatsapp_templates_fetch_error', { error: (err as Error).message });
    }

    const defaultTemplates = {
        session_absent: DEFAULT_SESSION_ABSENT_TEMPLATES,
        exam_result: DEFAULT_EXAM_RESULT_TEMPLATES,
    };
    
    // Cache the default fallback as well to prevent spamming DB on error
    await cache.set(CACHE_KEY, defaultTemplates, CACHE_TTL);
    
    return defaultTemplates;
}

/**
 * Returns a semi-random template to avoid identical message spam.
 * Replaces placeholders: {studentName}, {sessionTitle}, {examName}, {studentScore}, {examTotal}
 */
export async function pickTemplate(
    kind: 'session_absent' | 'exam_result',
    replacements: Record<string, string>,
): Promise<{ text: string; templateIdx: number }> {
    const templatesList = await getWhatsAppTemplates();
    const array = templatesList[kind] || DEFAULT_SESSION_ABSENT_TEMPLATES;

    // Pick a pseudo-random template using the current minute/second and phone length
    // to cycle through templates naturally without needing to store state per teacher.
    const randomness = new Date().getMinutes() + new Date().getSeconds();
    const index = randomness % Math.max(1, array.length);

    let text = array[index] || '';

    for (const [key, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    // Append the standard footer with opt-out instruction
    text += '\n\nللإلغاء أرسل "إلغاء"';

    return { text, templateIdx: index };
}
