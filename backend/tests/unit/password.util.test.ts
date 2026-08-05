/**
 * tests/unit/password.util.test.ts
 *
 * Unit tests for PasswordUtil in src/common/utils/password.util.ts
 *
 * Uses real bcrypt — intentional. Mocking bcrypt would test the mock, not the utility.
 * Note: bcrypt is inherently slow; tests may take ~1-2s each (expected).
 */

import { describe, it, expect } from 'vitest';
import { PasswordUtil } from '../../src/common/utils/password.util.js';

// =============================================================================
// hashPassword
// =============================================================================
describe('PasswordUtil.hashPassword', () => {

    it('يُعيد string مختلف تماماً عن الـ input', async () => {
        const hash = await PasswordUtil.hashPassword('myPassword123');
        expect(hash).not.toBe('myPassword123');
        expect(typeof hash).toBe('string');
    });

    it('الناتج يبدأ بـ $2b$ — صيغة bcrypt صحيحة', async () => {
        const hash = await PasswordUtil.hashPassword('testPass');
        expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('نفس الـ password يُولّد hash مختلف في كل مرة (random salt)', async () => {
        const hash1 = await PasswordUtil.hashPassword('samePassword');
        const hash2 = await PasswordUtil.hashPassword('samePassword');
        expect(hash1).not.toBe(hash2);
    });

    it('يرفض password فارغ بـ Error', async () => {
        await expect(PasswordUtil.hashPassword('')).rejects.toThrow();
    });

    it('يرفض string من spaces فقط بـ Error', async () => {
        await expect(PasswordUtil.hashPassword('   ')).rejects.toThrow();
    });

    it('يقبل password طويل (72 char — حد bcrypt)', async () => {
        const longPass = 'a'.repeat(72);
        const hash = await PasswordUtil.hashPassword(longPass);
        expect(hash.startsWith('$2b$')).toBe(true);
    });
});

// =============================================================================
// comparePassword
// =============================================================================
describe('PasswordUtil.comparePassword', () => {

    it('يُعيد true لو الـ password صحيح', async () => {
        const plain = 'correctPassword123';
        const hash  = await PasswordUtil.hashPassword(plain);
        const match = await PasswordUtil.comparePassword(plain, hash);
        expect(match).toBe(true);
    });

    it('يُعيد false لو الـ password خاطئ', async () => {
        const hash  = await PasswordUtil.hashPassword('theRealPassword');
        const match = await PasswordUtil.comparePassword('wrongPassword', hash);
        expect(match).toBe(false);
    });

    it('يُعيد false لو الـ password فارغ', async () => {
        const hash  = await PasswordUtil.hashPassword('somePassword');
        const match = await PasswordUtil.comparePassword('', hash);
        expect(match).toBe(false);
    });

    it('يُعيد false لو الـ hash فارغ', async () => {
        const match = await PasswordUtil.comparePassword('anyPassword', '');
        expect(match).toBe(false);
    });

    it('حساس لحالة الأحرف (case-sensitive)', async () => {
        const hash  = await PasswordUtil.hashPassword('Password123');
        const match = await PasswordUtil.comparePassword('password123', hash);
        expect(match).toBe(false);
    });

    it('مسافة في البداية تُعدّ مختلفة عن الأصل', async () => {
        const hash  = await PasswordUtil.hashPassword('noSpaces');
        const match = await PasswordUtil.comparePassword(' noSpaces', hash);
        expect(match).toBe(false);
    });
});
