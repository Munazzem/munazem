/**
 * tests/integration/groups.api.test.ts
 *
 * Integration tests for the Groups module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup } from '../helpers/db.helper.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

// =============================================================================
// POST /groups
// =============================================================================
describe('POST /groups', () => {

    it('يُنشئ مجموعة بنجاح ويرجع 201', async () => {
        await seedTeacher();

        const res = await app
            .post('/groups')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                name: 'مجموعة الأبطال',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الأحد', time: '14:00' }],
                capacity: 30
            });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('مجموعة الأبطال');
        expect(res.body.data.teacherId).toBeDefined();
    });

    it('assistant يمكنه إنشاء مجموعة للمدرس ويرجع 201', async () => {
        await seedTeacher();
        await seedAssistant();

        const res = await app
            .post('/groups')
            .set('Authorization', bearerHeader(makeAssistantToken()))
            .send({
                name: 'مجموعة المساعد',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الاثنين', time: '16:00' }],
                capacity: 25
            });

        expect(res.status).toBe(201);
        expect(res.body.data.name).toBe('مجموعة المساعد');
    });

    it('يرفض بـ 400 لو بيانات الـ validation ناقصة', async () => {
        await seedTeacher();

        const res = await app
            .post('/groups')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                name: 'مجموعة بدون gradeLevel'
            });

        expect(res.status).toBe(400);
    });

    describe('customPrice validation', () => {
        it('يُنشئ مجموعة بـ customPrice: 200 بنجاح', async () => {
            await seedTeacher();
            const res = await app.post('/groups').set('Authorization', bearerHeader(makeTeacherToken())).send({
                name: 'VIP Group',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الأحد', time: '14:00' }],
                customPrice: 200
            });
            expect(res.status).toBe(201);
            expect(res.body.data.customPrice).toBe(200);
        });

        it('يُنشئ مجموعة بدون customPrice بنجاح', async () => {
            await seedTeacher();
            const res = await app.post('/groups').set('Authorization', bearerHeader(makeTeacherToken())).send({
                name: 'Normal Group',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الأحد', time: '14:00' }]
            });
            expect(res.status).toBe(201);
            expect(res.body.data.customPrice).toBeUndefined();
        });

        it('يرفض بـ 400 لو customPrice: 0', async () => {
            await seedTeacher();
            const res = await app.post('/groups').set('Authorization', bearerHeader(makeTeacherToken())).send({
                name: 'Free Group',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الأحد', time: '14:00' }],
                customPrice: 0
            });
            expect(res.status).toBe(400);
        });

        it('يرفض بـ 400 لو customPrice بالسالب', async () => {
            await seedTeacher();
            const res = await app.post('/groups').set('Authorization', bearerHeader(makeTeacherToken())).send({
                name: 'Negative Group',
                gradeLevel: GradeLevel.PREP_1,
                schedule: [{ day: 'الأحد', time: '14:00' }],
                customPrice: -50
            });
            expect(res.status).toBe(400);
        });
    });
});

// =============================================================================
// GET /groups
// =============================================================================
describe('GET /groups', () => {

    it('يُرجع قائمة المجموعات الخاصة بالمعلم', async () => {
        await seedTeacher();
        await seedGroup({ name: 'مجموعة 1' });
        await seedGroup({ name: 'مجموعة 2' });

        const res = await app
            .get('/groups')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBe(2);
    });

    it('يدعم الـ Pagination', async () => {
        await seedTeacher();
        await seedGroup();
        await seedGroup();
        await seedGroup();

        const res = await app
            .get('/groups?page=1&limit=2')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBe(2);
        expect(res.body.data.pagination.total).toBe(3);
    });

    it('assistant يرى نفس المجموعات الخاصة بالمعلم', async () => {
        await seedTeacher();
        await seedAssistant();
        await seedGroup({ name: 'مجموعة المعلم' });

        const res = await app
            .get('/groups')
            .set('Authorization', bearerHeader(makeAssistantToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBe(1);
        expect(res.body.data.data[0].name).toBe('مجموعة المعلم');
    });
});

// =============================================================================
// GET /groups/:id
// =============================================================================
describe('GET /groups/:id', () => {

    it('يُرجع بيانات المجموعة المطلوبة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();

        const res = await app
            .get(`/groups/${group._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data._id).toBe(group._id.toString());
    });

    it('يرجع 404 لو المجموعة غير موجودة', async () => {
        await seedTeacher();

        const res = await app
            .get('/groups/6a6cbd60e0becff1f643fbb1') // fake ID
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(404);
    });
});

// =============================================================================
// PUT /groups/:id
// =============================================================================
describe('PUT /groups/:id', () => {

    it('يُحدّث بيانات المجموعة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup({ name: 'مجموعة قديمة' });

        const res = await app
            .put(`/groups/${group._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ name: 'مجموعة جديدة' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('مجموعة جديدة');
    });

    it('يرجع 404 لو المجموعة غير موجودة', async () => {
        await seedTeacher();

        const res = await app
            .put('/groups/6a6cbd60e0becff1f643fbb1')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ name: 'مجموعة جديدة' });

        expect(res.status).toBe(404);
    });

    it('يُحدّث customPrice لقيمة صحيحة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup({ name: 'مجموعة قديمة', customPrice: undefined });

        const res = await app
            .put(`/groups/${group._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ customPrice: 300 });

        expect(res.status).toBe(200);
        expect(res.body.data.customPrice).toBe(300);
    });

    it('يمسح customPrice بإرسال null (للرجوع لسعر المرحلة)', async () => {
        await seedTeacher();
        const group = await seedGroup({ name: 'مجموعة مخصصة', customPrice: 200 });

        const res = await app
            .put(`/groups/${group._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ customPrice: null });

        expect(res.status).toBe(200);
        expect(res.body.data.customPrice).toBeNull();
    });
});

// =============================================================================
// DELETE /groups/:id
// =============================================================================
describe('DELETE /groups/:id', () => {

    it('يحذف المجموعة بنجاح ويرجع 200', async () => {
        await seedTeacher();
        const group = await seedGroup();

        const res = await app
            .delete(`/groups/${group._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('بنجاح');
    });

    it('يرجع 404 لو المجموعة غير موجودة للحذف', async () => {
        await seedTeacher();

        const res = await app
            .delete('/groups/6a6cbd60e0becff1f643fbb1')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(404);
    });
});
