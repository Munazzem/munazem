import { cache } from '../cache/cache.service.js';
import { PlatformSettingsModel } from '../../database/models/platform-settings.model.js';
import { logger } from '../../common/utils/logger.util.js';

// ── Default Session Absent Templates (Rich, Diverse, ending with Call to Action) ──
export const DEFAULT_SESSION_ABSENT_TEMPLATES = [
    'السلام عليكم ورحمة الله،\nنحيطكم علمًا بأن الطالب/ة **{studentName}** تم تسجيل غيابه عن موعد حصة اليوم ({date}).\n\n📌 **الرجاء الرد بـ (تم) لتأكيد استلام الإشعار.**',
    'أهلاً بحضرتك يا فندم،\nحرصًا منا على متابعة المستوى الدراسي للطالب/ة **{studentName}**، نود إبلاغكم بعدم حضوره لحصة اليوم ({date}). نرجو الاطمئنان عليه ومتابعة تعويض ما فاته.\n\n📌 **يرجى الرد بكلمة (تم) للتأكيد.**',
    '⚠️ **تنبيه غياب**:\nتم تسجيل غياب **{studentName}** عن حصة [**{sessionTitle}**] بتاريخ **{date}**.\n\n📌 **الرجاء الرد بـ (تم) لتأكيد العلم.**',
    'تحية طيبة وبعد،\nنود إحاطتكم علمًا بأن الطالب/ة **{studentName}** لم يسجل حضورًا بحصة اليوم **{date}**.\n\n📌 **الرجاء الرد بـ (تم) للاطلاع.**',
    'أهلاً بحضرتك،\nنلفت انتباهكم إلى غياب **{studentName}** عن حصة اليوم. برجاء المتابعة مع الطالب لمعرفة سبب الغياب.\n\n📌 **يرجى الرد بـ (تم) لتأكيد المتابعة.**',
    '📌 **إشعار هام**:\nالطالب/ة **{studentName}** غائب اليوم عن الحصة ({date}).\n\n📌 **الرجاء الرد بـ (تم) لتأكيد الاستلام.**'
];

// ── Default Exam Result Templates (Rich, Diverse, ending with Call to Action) ──
export const DEFAULT_EXAM_RESULT_TEMPLATES = [
    'السلام عليكم ورحمة الله،\nتقرير نتيجة اختبار [**{examName}**] للطالب/ة: **{studentName}**\n📊 الدرجة: **{studentScore} من {examTotal}** ({percentage}%)\n\n📌 **الرجاء الرد بـ (تم) لتأكيد الاطلاع على النتيجة.**',
    'أهلاً بحضرتك يا فندم،\nتم رصد درجات اختبار **{examName}**، وحصل **{studentName}** على: **{studentScore} من {examTotal}** ({percentage}%).\nشاكرين لكم حرصكم ومتابعتكم المستمرة لمستوى الطالب.\n\n📌 **يرجى الرد بكلمة (تم) لتأكيد الاستلام.**',
    '📈 **إشعار نتيجة اختبار**:\nالطالب/ة: **{studentName}** | الاختبار: **{examName}**\n🎯 النتيجة المحققة: **{studentScore} من {examTotal}** ({percentage}%)\n\n📌 **الرجاء الرد بـ (تم) للتأكيد.**',
    'تحية طيبة،\nنود إحاطتكم علمًا بنتيجة **{studentName}** في اختبار **{examName}**:\n📊 الدرجة: **{studentScore} من {examTotal}** ({percentage}%).\nمع تمنياتنا للطالب بدوام التوفيق والتقدم.\n\n📌 **الرجاء الرد بـ (تم) للاطلاع.**',
    'أهلاً بحضرتك،\nنتيجة اختبار **{examName}** للطالب/ة **{studentName}**:\n📊 **{studentScore} من {examTotal}** ({percentage}%).\nنقدر دعمكم المتواصل لتطوير أداء الطالب.\n\n📌 **يرجى الرد بـ (تم) لتأكيد المتابعة.**',
    '📌 **تقرير درجات الاختبار**:\nتم رصد نتيجة **{examName}** للطالب/ة **{studentName}**، وكانت الدرجة: **{studentScore} من {examTotal}** بنسبة ({percentage}%).\n\n📌 **الرجاء الرد بـ (تم) لتأكيد العلم.**'
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
    
    await cache.set(CACHE_KEY, defaultTemplates, CACHE_TTL);
    return defaultTemplates;
}

/**
 * Returns a pseudo-random rotating template to avoid identical message spam.
 * Replaces placeholders: {studentName}, {sessionTitle}, {examName}, {studentScore}, {examTotal}, {date}, etc.
 */
export async function pickTemplate(
    kind: 'session_absent' | 'exam_result',
    replacements: Record<string, string>,
): Promise<{ text: string; templateIdx: number }> {
    const templatesList = await getWhatsAppTemplates();
    const array = templatesList[kind] || DEFAULT_SESSION_ABSENT_TEMPLATES;

    // Use current time and student name hash for organic template rotation
    const hash = (replacements.studentName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const timeFactor = new Date().getMinutes() + new Date().getSeconds();
    const index = (hash + timeFactor) % Math.max(1, array.length);

    let text = array[index] || array[0] || '';

    for (const [key, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    // Append teacher signature cleanly
    if (replacements.teacherName) {
        const cleanedName = replacements.teacherName.replace(/\s*\(.*?\)\s*/g, '').trim();
        text += `\nمع تحيات: أ/ ${cleanedName}`;
    }

    return { text, templateIdx: index };
}
