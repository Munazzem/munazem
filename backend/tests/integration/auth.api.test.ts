/**
 * tests/integration/auth.api.test.ts
 *
 * Integration tests for the Authentication module — all 6 endpoints:
 *   POST  /auth/login
 *   POST  /auth/refresh
 *   GET   /auth/me
 *   PATCH /auth/me
 *   PATCH /auth/change-password
 *   PATCH /auth/assistants-access
 *
 * DB: MongoMemoryServer (started in setup.ts, wiped after each test in setup.env.ts)
 * Auth: Real JWTs from auth.helper.ts + real bcrypt hashing for login tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp }    from '../helpers/app.helper.js';
import {
    makeTeacherToken,
    makeAssistantToken,
    bearerHeader,
} from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant } from '../helpers/db.helper.js';
import { PasswordUtil }  from '../../src/common/utils/password.util.js';
import { UserModel }     from '../../src/database/models/user.model.js';

// Known plain-text password used in login tests
const TEST_PASSWORD = 'testPass123';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

/**
 * Seeds a teacher whose stored password is the real bcrypt hash of TEST_PASSWORD.
 * Required for any test that calls POST /auth/login.
 */
async function seedTeacherWithRealPassword(overrides: Record<string, unknown> = {}) {
    const hashed = await PasswordUtil.hashPassword(TEST_PASSWORD);
    return seedTeacher({ password: hashed, ...overrides });
}

// =============================================================================
// POST /auth/login
// =============================================================================
describe('POST /auth/login', () => {

    it('يُسجّل الدخول بنجاح ويُعيد token + refreshToken + user بدون password', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: TEST_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.password).toBeUndefined();
    });

    it('يُعيد دور المستخدم الصحيح (teacher)', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: TEST_PASSWORD });

        expect(res.body.data.user.role).toBe('teacher');
    });

    it('يرفض بـ 401 — password خاطئ', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: 'wrongPassword' });

        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — رقم هاتف غير مسجّل', async () => {
        const res = await app
            .post('/auth/login')
            .send({ phone: '01099999999', password: TEST_PASSWORD });

        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — حساب معطّل (isActive: false)', async () => {
        await seedTeacherWithRealPassword({ isActive: false });

        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: TEST_PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('إيقاف');
    });

    it('يرفض بـ 401 — assistant لما يكون assistantsAccessEnabled=false عند المعلم', async () => {
        await seedTeacher({ assistantsAccessEnabled: false });
        const assistantHashed = await PasswordUtil.hashPassword(TEST_PASSWORD);
        await seedAssistant({ password: assistantHashed });

        const res = await app
            .post('/auth/login')
            .send({ phone: '01100000001', password: TEST_PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.message).toContain('مغلق');
    });

    it('يرفض بـ 400 — phone ناقص (Zod validation)', async () => {
        const res = await app
            .post('/auth/login')
            .send({ password: TEST_PASSWORD });

        expect(res.status).toBe(400);
    });

    it('يرفض بـ 400 — password ناقص (Zod validation)', async () => {
        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001' });

        expect(res.status).toBe(400);
    });

    it('يرفض بـ 400 — phone أقل من 10 أحرف (Zod validation)', async () => {
        const res = await app
            .post('/auth/login')
            .send({ phone: '0100', password: TEST_PASSWORD });

        expect(res.status).toBe(400);
    });

    it('يرفض بـ 400 — password أقل من 6 أحرف (Zod validation)', async () => {
        const res = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: '123' });

        expect(res.status).toBe(400);
    });
});

// =============================================================================
// POST /auth/refresh
// =============================================================================
describe('POST /auth/refresh', () => {

    it('يُصدر tokens جديدة بـ refreshToken صالح', async () => {
        await seedTeacherWithRealPassword();

        // نعمل login أولاً للحصول على refreshToken حقيقي
        const loginRes = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: TEST_PASSWORD });
        const { refreshToken } = loginRes.body.data;

        const res = await app
            .post('/auth/refresh')
            .send({ refreshToken });

        expect(res.status).toBe(200);
        expect(res.body.data.token).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
    });

    it('الـ token الجديد مختلف عن القديم', async () => {
        await seedTeacherWithRealPassword();

        const loginRes = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: TEST_PASSWORD });
        const { token: oldToken, refreshToken } = loginRes.body.data;

        // انتظر ثانية واحدة لضمان تغيّر الـ timestamp (iat) في الـ JWT الجديد
        await new Promise(resolve => setTimeout(resolve, 1000));

        const res = await app
            .post('/auth/refresh')
            .send({ refreshToken });

        expect(res.body.data.token).not.toBe(oldToken);
    });

    it('يرفض بـ 401 — refreshToken مفقود', async () => {
        const res = await app
            .post('/auth/refresh')
            .send({});

        expect(res.status).toBe(401);
    });

    it('يرفض بـ 401 — refreshToken مزوّر', async () => {
        const res = await app
            .post('/auth/refresh')
            .send({ refreshToken: 'fake.refresh.token' });

        expect(res.status).toBe(401);
    });
});

// =============================================================================
// GET /auth/me
// =============================================================================
describe('GET /auth/me', () => {

    it('يُعيد بيانات المعلم كاملة بدون password', async () => {
        await seedTeacher();

        const res = await app
            .get('/auth/me')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.password).toBeUndefined();
        expect(res.body.data.role).toBe('teacher');
        expect(res.body.data._id).toBeDefined();
    });

    it('الـ assistant يرث centerName و logoUrl من المعلم', async () => {
        await seedTeacher({ centerName: 'مركز النجاح', logoUrl: 'https://img.test/logo.png' });
        await seedAssistant();

        const res = await app
            .get('/auth/me')
            .set('Authorization', bearerHeader(makeAssistantToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.centerName).toBe('مركز النجاح');
        expect(res.body.data.logoUrl).toBe('https://img.test/logo.png');
    });

    it('يرفض بـ 401 — بدون token', async () => {
        const res = await app.get('/auth/me');
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// PATCH /auth/me
// =============================================================================
describe('PATCH /auth/me', () => {

    it('يُحدّث الاسم بنجاح', async () => {
        await seedTeacher();

        const res = await app
            .patch('/auth/me')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ name: 'اسم جديد محدّث' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('اسم جديد محدّث');
    });

    it('يُحدّث رقم الهاتف بنجاح لو غير مستخدم', async () => {
        await seedTeacher();

        const res = await app
            .patch('/auth/me')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ phone: '01000000099' });

        expect(res.status).toBe(200);
        expect(res.body.data.phone).toBe('01000000099');
    });

    it('يرفض بـ 400 — رقم الهاتف مستخدم بحساب آخر', async () => {
        await seedTeacher();
        // أنشئ مستخدم ثاني بالرقم المُراد
        await UserModel.create({
            name:     'مستخدم آخر',
            phone:    '01055555555',
            password: 'hashed_placeholder',
            role:     'teacher',
            isActive: true,
        });

        const res = await app
            .patch('/auth/me')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ phone: '01055555555' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('مسجل بالفعل');
    });

    it('يرفض بـ 401 — بدون token', async () => {
        const res = await app.patch('/auth/me').send({ name: 'test' });
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// PATCH /auth/change-password
// =============================================================================
describe('PATCH /auth/change-password', () => {

    it('يغيّر الـ password بنجاح', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .patch('/auth/change-password')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ currentPassword: TEST_PASSWORD, newPassword: 'newPass456' });

        expect(res.status).toBe(200);
    });

    it('بعد التغيير — الـ password الجديد يشتغل في الـ login', async () => {
        await seedTeacherWithRealPassword();

        await app
            .patch('/auth/change-password')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ currentPassword: TEST_PASSWORD, newPassword: 'newPass456' });

        const loginRes = await app
            .post('/auth/login')
            .send({ phone: '01000000001', password: 'newPass456' });

        expect(loginRes.status).toBe(200);
    });

    it('يرفض بـ 400 — currentPassword خاطئ', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .patch('/auth/change-password')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ currentPassword: 'wrongOldPass', newPassword: 'newPass456' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('غير صحيحة');
    });

    it('يرفض بـ 400 — newPassword أقل من 6 أحرف', async () => {
        await seedTeacherWithRealPassword();

        const res = await app
            .patch('/auth/change-password')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ currentPassword: TEST_PASSWORD, newPassword: '123' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('6 أحرف');
    });

    it('يرفض بـ 400 — newPassword مفقود', async () => {
        await seedTeacher();

        const res = await app
            .patch('/auth/change-password')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ currentPassword: TEST_PASSWORD });

        expect(res.status).toBe(400);
    });

    it('يرفض بـ 401 — بدون token', async () => {
        const res = await app
            .patch('/auth/change-password')
            .send({ currentPassword: TEST_PASSWORD, newPassword: 'newPass456' });

        expect(res.status).toBe(401);
    });
});

// =============================================================================
// PATCH /auth/assistants-access
// =============================================================================
describe('PATCH /auth/assistants-access', () => {

    it('teacher يُوقف صلاحيات الـ assistants بنجاح', async () => {
        await seedTeacher();

        const res = await app
            .patch('/auth/assistants-access')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ enabled: false });

        expect(res.status).toBe(200);
        expect(res.body.data.assistantsAccessEnabled).toBe(false);
    });

    it('teacher يُعيد تفعيل صلاحيات الـ assistants بنجاح', async () => {
        await seedTeacher({ assistantsAccessEnabled: false });

        const res = await app
            .patch('/auth/assistants-access')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ enabled: true });

        expect(res.status).toBe(200);
        expect(res.body.data.assistantsAccessEnabled).toBe(true);
    });

    it('يرفض الـ assistant بـ 403 — teacher-only operation', async () => {
        await seedTeacher();
        await seedAssistant();

        const res = await app
            .patch('/auth/assistants-access')
            .set('Authorization', bearerHeader(makeAssistantToken()))
            .send({ enabled: false });

        expect(res.status).toBe(403);
    });

    it('يرفض بـ 400 — enabled مش boolean (string بدلها)', async () => {
        await seedTeacher();

        const res = await app
            .patch('/auth/assistants-access')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ enabled: 'yes' });

        expect(res.status).toBe(400);
    });

    it('يرفض بـ 401 — بدون token', async () => {
        const res = await app
            .patch('/auth/assistants-access')
            .send({ enabled: false });

        expect(res.status).toBe(401);
    });
});
