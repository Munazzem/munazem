import { cache } from '../cache/cache.service.js';
import { PlatformSettingsModel } from '../../database/models/platform-settings.model.js';
import { logger } from '../../common/utils/logger.util.js';

// ── Default Fallback Templates (No Emojis except ⚠️) ──
export const DEFAULT_SESSION_ABSENT_TEMPLATES = [
    'أهلاً بحضرتك،\nنحيطكم علمًا بأن الطالب **{studentName}** تم تسجيل غيابه عن حصة اليوم.\n\n📅 تاريخ الحصة: **{date}**\n\nلمتابعة سجل الحضور والغياب:\nhttps://munazem.vercel.app/parent',
    'السلام عليكم،\nتم تسجيل غياب الطالب **{studentName}** عن حصة **{date}**.\n\nيمكنكم متابعة تفاصيل الحضور والغياب من خلال بوابة ولي الأمر:\nhttps://munazem.vercel.app/parent',
    'تنبيه حضور 📌\n\nالطالب: **{studentName}**\nالحالة: **غائب**\nتاريخ الحصة: **{date}**\n\nلمتابعة سجل الطالب:\nhttps://munazem.vercel.app/parent',
    'تم تسجيل غياب **{studentName}** عن حصة اليوم **{date}**.\n\nيمكنكم مراجعة سجل الحضور والغياب الخاص بالطالب من هنا:\nhttps://munazem.vercel.app/parent',
    'نود إبلاغ حضرتك بأنه تم تسجيل **غياب الطالب {studentName}** عن حصة **{date}**.\n\nلمتابعة الحضور والغياب وباقي بيانات الطالب:\nhttps://munazem.vercel.app/parent',
    '📌 إشعار غياب\n\nالطالب **{studentName}** لم يحضر حصة **{date}**، وتم تسجيل الغياب على النظام.\n\nللاطلاع على تفاصيل الحضور والغياب:\nhttps://munazem.vercel.app/parent'
];

export const DEFAULT_EXAM_RESULT_TEMPLATES = [
    'أهلاً بحضرتك،\nنحيطكم علمًا بظهور نتيجة امتحان **{examName}** للطالب **{studentName}**.\n\n📊 النتيجة: **{studentScore} من {examTotal}**\n\nلمتابعة نتيجة الطالب وباقي بياناته:\nhttps://munazem.vercel.app/parent',
    'السلام عليكم،\nنتيجة الطالب **{studentName}** في امتحان **{examName}**:\n\n**{studentScore} من {examTotal}** 📈\n\nيمكنكم متابعة تفاصيل الطالب من خلال بوابة ولي الأمر:\nhttps://munazem.vercel.app/parent',
    'أهلاً بحضرتك،\nتم تسجيل نتيجة **{studentName}** في امتحان **{examName}**.\n\nالدرجة: **{studentScore} / {examTotal}** 📊\n\nللاطلاع على النتيجة ومتابعة مستوى الطالب:\nhttps://munazem.vercel.app/parent',
    'تنبيه بظهور نتيجة الامتحان 📌\n\nالطالب: **{studentName}**\nالامتحان: **{examName}**\nالنتيجة: **{studentScore} من {examTotal}**\n\nلمتابعة بيانات الطالب ونتائجه:\nhttps://munazem.vercel.app/parent',
    'تم إعلان نتيجة امتحان **{examName}** للطالب **{studentName}**.\n\n📌 الدرجة: **{studentScore} من {examTotal}**\n\nيمكنكم متابعة النتائج والتفاصيل من بوابة ولي الأمر:\nhttps://munazem.vercel.app/parent',
    'نتيجة امتحان **{examName}** للطالب **{studentName}**:\n\n📊 **{studentScore} من {examTotal}**\n\nلمتابعة نتيجة الطالب وسجل الاختبارات الخاص به، يمكنكم الدخول من هنا:\nhttps://munazem.vercel.app/parent'
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

    // Append the teacher signature
    if (replacements.teacherName) {
        const cleanedName = replacements.teacherName.replace(/\s*\(.*?\)\s*/g, '').trim(); // Remove subject inside parentheses if any
        text += `\n\nمع تحيات أ/ ${cleanedName}`;
    }

    return { text, templateIdx: index };
}
