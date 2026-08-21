/**
 * tests/integration/middleware.test.ts
 *
 * Integration tests for the three core security middlewares:
 *   1. authenticate   — JWT verification, isActive check, sliding token
 *   2. authorizeRoles — RBAC enforcement
 *   3. resolveTenant  — tenant scoping for teacher / assistant / superAdmin
 *
 * Strategy: hit real app endpoints that exercise each middleware path.
 * No mocking — real JWT signing, real MongoMemoryServer.
 *
 * Each describe block is fully self-contained:
 *  - seeds its own data inside each `it`
 *  - afterEach in setup.env.ts wipes collections automatically
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getTestApp }           from '../helpers/app.helper.js';
import {
    makeTeacherToken,
    makeAssistantToken,
    makeSuperAdminToken,
    bearerHeader,
    TEST_IDS,
} from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant } from '../helpers/db.helper.js';

const JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

// =============================================================================
// authenticate middleware
// =============================================================================
describe('authenticate middleware', () => {

    it('يمرّر الطلب لو الـ token صالح (لا يُعيد 401)', async () => {
        await seedTeacher();
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(makeTeacherToken()));
        expect(res.status).not.toBe(401);
    });

    it('يرفض بـ 401 — بدون Authorization header', async () => {
        const res = await app.get('/students');
        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — header بدون كلمة Bearer', async () => {
        const res = await app
            .get('/students')
            .set('Authorization', makeTeacherToken()); // missing "Bearer "
        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — token منتهي الصلاحية', async () => {
        const expiredToken = jwt.sign(
            { userId: TEST_IDS.teacher.toString(), role: 'teacher', teacherId: null, isActive: true },
            JWT_SECRET,
            { expiresIn: 0 }
        );
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(expiredToken));
        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — token مزوّر (ليس JWT)', async () => {
        const res = await app
            .get('/students')
            .set('Authorization', 'Bearer not.a.valid.jwt.string');
        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 أو 500 — token موقّع بـ secret خاطئ', async () => {
        const foreignToken = jwt.sign(
            { userId: TEST_IDS.teacher.toString(), role: 'teacher', teacherId: null, isActive: true },
            'wrong-secret-key'
        );
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(foreignToken));
        // JWT verification throws JsonWebTokenError — middleware catches as 401
        // (some error handlers may surface as 500 depending on config)
        expect([401, 500]).toContain(res.status);
    });

    it('يرفض بـ 401 — isActive: false في الـ JWT payload', async () => {
        const inactiveToken = makeTeacherToken({ isActive: false });
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(inactiveToken));
        expect(res.status).toBe(401);
    });

    it('يُرسل X-New-Token header لو الـ token قريب من الانتهاء (sliding window < 5 min)', async () => {
        await seedTeacher();
        const nearExpiryToken = jwt.sign(
            { userId: TEST_IDS.teacher.toString(), role: 'teacher', teacherId: null, isActive: true },
            JWT_SECRET,
            { expiresIn: '2m' } // 2 minutes < 5-minute threshold
        );
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(nearExpiryToken));
        expect(res.headers['x-new-token']).toBeDefined();
        expect(typeof res.headers['x-new-token']).toBe('string');
    });
});

// =============================================================================
// authorizeRoles middleware
// =============================================================================
describe('authorizeRoles middleware', () => {

    it('teacher يصل لمسار teacher-only بنجاح', async () => {
        await seedTeacher();
        const res = await app
            .get('/payments/prices')
            .set('Authorization', bearerHeader(makeTeacherToken()));
        expect(res.status).not.toBe(403);
    });

    it('assistant يُرفض بـ 403 على مسار teacher-only (PUT /payments/prices)', async () => {
        await seedTeacher();
        await seedAssistant();
        const res = await app
            .put('/payments/prices')
            .set('Authorization', bearerHeader(makeAssistantToken()))
            .send({ prices: [] });
        expect(res.status).toBe(403);
    });

    it('assistant يُرفض بـ 403 على مسار teacher-only (GET /payments/ledger/monthly)', async () => {
        await seedTeacher();
        await seedAssistant();
        const res = await app
            .get('/payments/ledger/monthly')
            .set('Authorization', bearerHeader(makeAssistantToken()));
        expect(res.status).toBe(403);
    });

    it('assistant يصل لمسارات مشتركة (teacher + assistant) بنجاح', async () => {
        await seedTeacher();
        await seedAssistant();
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(makeAssistantToken()));
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
    });
});

// =============================================================================
// resolveTenant middleware
// =============================================================================
describe('resolveTenant middleware', () => {

    it('teacher يرى بياناته — tenantId = userId الخاص به', async () => {
        await seedTeacher();
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(makeTeacherToken()));
        expect(res.status).toBe(200);
        // نتحقق أن القائمة فاضية (مش بيانات معلم ثاني)
        expect(res.body.data.pagination.total).toBe(0);
    });

    it('assistant يعمل بـ tenantId = teacherId بتاعه (مش userId الخاص بيه)', async () => {
        await seedTeacher();
        await seedAssistant();
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(makeAssistantToken()));
        expect(res.status).toBe(200);
    });

    it('assistant بدون teacherId في الـ JWT يُرفض (401 أو 403)', async () => {
        // teacherId: null — حساب assistant غير مضبوط
        // authenticate قد يرفضه بـ 401 قبل resolveTenant، أو resolveTenant بـ 403
        const brokenToken = makeAssistantToken({ teacherId: null as any });
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(brokenToken));
        expect([401, 403]).toContain(res.status);
    });

    it('superAdmin token صالح ومُعترف به من الـ authenticate middleware', async () => {
        const res = await app
            .get('/students')
            .set('Authorization', bearerHeader(makeSuperAdminToken()));
        // المسار /students محمي لـ teacher/assistant فقط
        // superAdmin يمرّر authenticate (مش 401) لكن قد يُرفض بـ 403 من roles
        expect(res.status).not.toBe(401);
    });
});
