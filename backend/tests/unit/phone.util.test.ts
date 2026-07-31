/**
 * tests/unit/phone.util.test.ts
 *
 * Unit tests for normalizePhone() in src/common/utils/phone.util.ts
 * Pure function — no DB, no app instance needed.
 */

import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../../src/common/utils/phone.util.js';

describe('normalizePhone', () => {

    // ── Standard Egyptian formats ────────────────────────────────────────────

    it('يحوّل الصيغة المحلية 01x → 201x', () => {
        expect(normalizePhone('01012345678')).toBe('201012345678');
        expect(normalizePhone('01112345678')).toBe('201112345678');
        expect(normalizePhone('01212345678')).toBe('201212345678');
        expect(normalizePhone('01512345678')).toBe('201512345678');
    });

    it('يحوّل الصيغة القصيرة 10 أرقام تبدأ بـ 1 → 201x', () => {
        // 1012345678 (10 digits without leading 0)
        expect(normalizePhone('1012345678')).toBe('201012345678');
    });

    it('لا يغيّر رقماً مُعَوْلَم بالفعل يبدأ بـ 20', () => {
        expect(normalizePhone('201012345678')).toBe('201012345678');
        expect(normalizePhone('201512345678')).toBe('201512345678');
    });

    // ── Non-digit characters stripped ────────────────────────────────────────

    it('يحذف الشرطات والمسافات قبل التحويل', () => {
        expect(normalizePhone('010-1234-5678')).toBe('201012345678');
        expect(normalizePhone('010 1234 5678')).toBe('201012345678');
    });

    it('يحذف الأقواس والرموز الشائعة', () => {
        expect(normalizePhone('+2(010)12345678')).toBe('201012345678');
    });

    it('يحذف المسافة في بداية الرقم', () => {
        expect(normalizePhone(' 01012345678')).toBe('201012345678');
    });

    // ── Output properties ────────────────────────────────────────────────────

    it('الناتج دايماً string يبدأ بـ 20', () => {
        const result = normalizePhone('01012345678');
        expect(typeof result).toBe('string');
        expect(result.startsWith('20')).toBe(true);
    });

    it('الرقم المصري الطبيعي ينتج 12 رقم', () => {
        expect(normalizePhone('01012345678')).toHaveLength(12);
        expect(normalizePhone('201012345678')).toHaveLength(12);
    });
});
