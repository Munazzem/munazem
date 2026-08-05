/**
 * tests/unit/date.util.test.ts
 *
 * Unit tests لدوال التوقيت في src/common/utils/date.util.ts
 *
 * هذه الدوال حرجة لأنها:
 * - تحدد أي "يوم" تنتمي له كل معاملة مالية
 * - تحدد إذا كان تسجيل الحضور قبل أو في يوم الحصة
 * - منطق Egypt UTC+3 بدون DST
 *
 * ✅ هذه tests لا تحتاج DB — pure functions فقط
 */

import { describe, it, expect } from 'vitest';
import {
    startOfDayEgypt,
    startOfDayEgyptMs,
    todayEgypt,
    egyptDayBounds,
    resolveTransactionDate,
    EGYPT_OFFSET_MS,
} from '../../src/common/utils/date.util.js';

// ─── Helper constant ──────────────────────────────────────────────────────────
const THREE_HOURS_MS = 3 * 60 * 60 * 1000; // 10_800_000

// =============================================================================
// startOfDayEgypt
// =============================================================================
describe('startOfDayEgypt', () => {

    it('تُرجع midnight UTC لنفس اليوم المصري (مثال الـ docstring الأول)', () => {
        // 7 PM UTC = 10 PM Egypt → نفس اليوم المصري (May 18)
        const input = new Date('2025-05-18T19:00:00.000Z');
        const result = startOfDayEgypt(input);

        expect(result.toISOString()).toBe('2025-05-18T00:00:00.000Z');
    });

    it('تُرجع midnight UTC لليوم المصري الصحيح عند 1 صباح مصر (مثال الـ docstring الثاني)', () => {
        // 10 PM UTC (May 18) = 1 AM Egypt (May 19) → اليوم المصري هو May 19
        const input = new Date('2025-05-18T22:00:00.000Z');
        const result = startOfDayEgypt(input);

        expect(result.toISOString()).toBe('2025-05-19T00:00:00.000Z');
    });

    it('تُرجع midnight UTC عند منتصف الليل بالضبط UTC (يعني 3 صباح مصر)', () => {
        // UTC midnight = 3 AM Egypt → نفس اليوم المصري
        const input = new Date('2025-06-15T00:00:00.000Z');
        const result = startOfDayEgypt(input);

        expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
    });

    it('تُرجع midnight UTC ليوم مختلف عند 11 PM بتوقيت مصر (26 UTC -1 second)', () => {
        // 8 PM UTC = 11 PM Egypt → لسه نفس اليوم المصري
        const input = new Date('2025-07-20T20:00:00.000Z');
        const result = startOfDayEgypt(input);

        expect(result.toISOString()).toBe('2025-07-20T00:00:00.000Z');
    });

    it('تُرجع Date object (مش number)', () => {
        const result = startOfDayEgypt(new Date());
        expect(result).toBeInstanceOf(Date);
    });

    it('النتيجة دايماً عند UTC midnight (hours, minutes, seconds, ms = 0)', () => {
        const result = startOfDayEgypt(new Date('2025-03-10T14:30:45.123Z'));
        expect(result.getUTCHours()).toBe(0);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
        expect(result.getUTCMilliseconds()).toBe(0);
    });

});

// =============================================================================
// startOfDayEgyptMs
// =============================================================================
describe('startOfDayEgyptMs', () => {

    it('تُرجع number (milliseconds)', () => {
        const result = startOfDayEgyptMs(new Date());
        expect(typeof result).toBe('number');
    });

    it('تُرجع midnight مصر الحقيقي = 9 PM UTC السابق (UTC midnight مصر = 21:00 UTC)', () => {
        // May 18 midnight Egypt = May 17 21:00:00 UTC
        // لأن midnight مصر يساوي UTC - 3h
        const input = new Date('2025-05-18T12:00:00.000Z'); // ظهر UTC = 3 PM Egypt (نفس اليوم المصري)
        const result = startOfDayEgyptMs(input);

        const expectedMidnightEgypt = new Date('2025-05-17T21:00:00.000Z'); // midnight مصر (May 18 00:00 مصر)
        expect(result).toBe(expectedMidnightEgypt.getTime());
    });

    it('يرجع نتيجة أصغر من startOfDayEgypt بمقدار EGYPT_OFFSET_MS', () => {
        // startOfDayEgypt تُرجع UTC midnight للتاريخ المصري
        // startOfDayEgyptMs تُرجع midnigh مصر الحقيقي
        // الفرق بينهم = 3 ساعات (EGYPT_OFFSET_MS)
        const input = new Date('2025-05-18T12:00:00.000Z');
        const dateResult = startOfDayEgypt(input);
        const msResult = startOfDayEgyptMs(input);

        expect(msResult).toBe(dateResult.getTime() - EGYPT_OFFSET_MS);
    });

    it('يوم ديسمبر (للتأكد من أن الـ logic لا يعتمد على DST)', () => {
        // مصر UTC+3 ثابت بدون DST
        const input = new Date('2025-12-25T10:00:00.000Z'); // 1 PM Egypt (Dec 25)
        const result = startOfDayEgyptMs(input);

        const expectedMidnightEgypt = new Date('2025-12-24T21:00:00.000Z');
        expect(result).toBe(expectedMidnightEgypt.getTime());
    });

    it('يُستخدم بشكل صحيح للمقارنة: اليوم ليس قبل موعد الحصة', () => {
        // هذا هو الاستخدام الفعلي في attendance.service.ts السطر 35
        const now = new Date('2025-05-18T12:00:00.000Z'); // اليوم
        const session = new Date('2025-05-18T08:00:00.000Z'); // الحصة نفس اليوم صباحاً

        // كلاهما في نفس اليوم المصري → يجب أن يكونا متساويين
        expect(startOfDayEgyptMs(now)).toBe(startOfDayEgyptMs(session));
    });

});

// =============================================================================
// todayEgypt
// =============================================================================
describe('todayEgypt', () => {

    it('تُرجع string بصيغة YYYY-MM-DD', () => {
        const result = todayEgypt();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('الطول دايماً 10 أحرف', () => {
        expect(todayEgypt()).toHaveLength(10);
    });

    it('السنة منطقية (بين 2024 و 2100)', () => {
        const year = parseInt(todayEgypt().split('-')[0]!);
        expect(year).toBeGreaterThanOrEqual(2024);
        expect(year).toBeLessThan(2100);
    });

});

// =============================================================================
// egyptDayBounds
// =============================================================================
describe('egyptDayBounds', () => {

    it('dayStart يساوي midnight مصر = 21:00 UTC السابق', () => {
        // May 18 2025 في مصر → midnight مصر = May 17 21:00 UTC
        const { dayStart } = egyptDayBounds(2025, 5, 18);
        expect(dayStart.toISOString()).toBe('2025-05-17T21:00:00.000Z');
    });

    it('dayEnd يساوي 23:59:59.999 مصر = 20:59:59.999 UTC', () => {
        // نهاية May 18 في مصر = May 18 20:59:59.999 UTC
        const { dayEnd } = egyptDayBounds(2025, 5, 18);
        expect(dayEnd.toISOString()).toBe('2025-05-18T20:59:59.999Z');
    });

    it('الفرق بين dayStart و dayEnd يساوي بالضبط 24 ساعة ناقص 1 millisecond', () => {
        const { dayStart, dayEnd } = egyptDayBounds(2025, 8, 15);
        const diffMs = dayEnd.getTime() - dayStart.getTime();
        expect(diffMs).toBe(24 * 60 * 60 * 1000 - 1);
    });

    it('أول يناير (اليوم الأول من السنة) يعمل بشكل صحيح', () => {
        const { dayStart } = egyptDayBounds(2025, 1, 1);
        expect(dayStart.toISOString()).toBe('2024-12-31T21:00:00.000Z');
    });

});

// =============================================================================
// resolveTransactionDate
// =============================================================================
describe('resolveTransactionDate', () => {

    it('بدون input تُرجع الوقت الحالي (في حدود ثانية واحدة)', () => {
        const before = Date.now();
        const result = resolveTransactionDate();
        const after = Date.now();

        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after + 1000); // هامش 1 ثانية
    });

    it('ISO string يُحوَّل مباشرة (يحتوي على T)', () => {
        const isoString = '2025-05-18T14:30:00.000Z';
        const result = resolveTransactionDate(isoString);
        expect(result.toISOString()).toBe(isoString);
    });

    it('ISO string بتوقيت مختلف يُحوَّل بدون تغيير', () => {
        const result = resolveTransactionDate('2025-01-15T09:00:00+03:00');
        expect(result.getTime()).toBe(new Date('2025-01-15T09:00:00+03:00').getTime());
    });

    it('تاريخ backdated YYYY-MM-DD يُرجع الظهيرة بتوقيت مصر = 09:00 UTC', () => {
        // "2025-01-15" هو في الماضي → يجب أن يكون 12:00 PM مصر = 09:00 UTC
        const result = resolveTransactionDate('2025-01-15');
        expect(result.getUTCHours()).toBe(9);
        expect(result.getUTCMinutes()).toBe(0);
        expect(result.getUTCSeconds()).toBe(0);
    });

    it('التاريخ المحسوب هو نفس اليوم المحدد (month و day صح)', () => {
        const result = resolveTransactionDate('2025-03-20');
        expect(result.getUTCFullYear()).toBe(2025);
        expect(result.getUTCMonth()).toBe(2);   // March = index 2
        expect(result.getUTCDate()).toBe(20);
    });

    it('تاريخ اليوم YYYY-MM-DD يُرجع الوقت الحالي (مش noon)', () => {
        // نحسب تاريخ اليوم بتوقيت مصر (نفس منطق الكود)
        const now = new Date();
        const egyptNow = new Date(now.getTime() + THREE_HOURS_MS);
        const todayStr = egyptNow.toISOString().split('T')[0]!;

        const before = Date.now();
        const result = resolveTransactionDate(todayStr);
        const after = Date.now();

        // يجب أن يكون قريب من الوقت الحالي (مش 09:00 UTC)
        expect(result.getTime()).toBeGreaterThanOrEqual(before);
        expect(result.getTime()).toBeLessThanOrEqual(after + 1000); // هامش 1 ثانية
    });

});
