/**
 * tests/integration/sessions.api.test.ts
 *
 * Integration tests for the Sessions module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedSession } from '../helpers/db.helper.js';
import { SessionStatus } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

// =============================================================================
// POST /sessions
// =============================================================================
describe('POST /sessions', () => {

    it('يُنشئ حصة جديدة بنجاح ويرجع 201', async () => {
        await seedTeacher();
        const group = await seedGroup();

        const res = await app
            .post('/sessions')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                groupId: group._id.toString(),
                date: '2026-10-15',
                startTime: '14:00'
            });

        expect(res.status).toBe(201);
        expect(res.body.data.date).toContain('2026-10-15');
        expect(res.body.data.startTime).toBe('14:00');
        expect(res.body.data.groupId).toBe(group._id.toString());
    });

    it('يرفض إنشاء حصة إذا كانت المجموعة لا تخص المعلم', async () => {
        await seedTeacher(); // Creates main teacher
        
        // We will seed another teacher by overriding _id
        const { UserModel } = await import('../../src/database/models/user.model.js');
        const otherTeacher = await UserModel.create({
            name: 'مدرس آخر',
            phone: '01111111111',
            password: 'hashed',
            role: 'teacher'
        });

        // Group belongs to other teacher
        const group = await seedGroup({ teacherId: otherTeacher._id as any });

        const res = await app
            .post('/sessions')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                groupId: group._id.toString(),
                date: '2026-10-15',
                startTime: '14:00'
            });

        expect(res.status).toBe(404); // GroupService checks if group exists for this teacher
    });
});

// =============================================================================
// GET /sessions
// =============================================================================
describe('GET /sessions', () => {

    it('يُرجع قائمة الحصص الخاصة بالمعلم', async () => {
        await seedTeacher();
        const group = await seedGroup();
        await seedSession({ groupId: group._id as any });
        await seedSession({ groupId: group._id as any });

        const res = await app
            .get('/sessions')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBe(2);
    });

    it('Assistant يمكنه جلب الحصص', async () => {
        await seedTeacher();
        await seedAssistant();
        const group = await seedGroup();
        await seedSession({ groupId: group._id as any });

        const res = await app
            .get('/sessions')
            .set('Authorization', bearerHeader(makeAssistantToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.data.length).toBe(1);
    });
});

// =============================================================================
// GET /sessions/:id
// =============================================================================
describe('GET /sessions/:id', () => {

    it('يُرجع بيانات الحصة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });

        const res = await app
            .get(`/sessions/${session._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data._id).toBe(session._id.toString());
    });
});

// =============================================================================
// PATCH /sessions/:id/status
// =============================================================================
describe('PATCH /sessions/:id/status', () => {

    it('يُحدث حالة الحصة إلى COMPLETED بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any, status: SessionStatus.SCHEDULED });

        const res = await app
            .patch(`/sessions/${session._id}/status`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({ status: SessionStatus.COMPLETED });

        expect(res.status).toBe(200);
        expect(res.body.data.session.status).toBe(SessionStatus.COMPLETED);
    });
});

// =============================================================================
// DELETE /sessions/:id
// =============================================================================
describe('DELETE /sessions/:id', () => {

    it('يحذف الحصة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });

        const res = await app
            .delete(`/sessions/${session._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('تم حذف الحصة');
    });
});

// =============================================================================
// POST /sessions/generate/today & generate-week
// =============================================================================
describe('Auto Generation', () => {
    it('generate/today لا يفشل حتى لو مفيش حصص', async () => {
        await seedTeacher();

        const res = await app
            .post('/sessions/generate/today')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
    });

    it('generate-week لا يفشل', async () => {
        await seedTeacher();

        const res = await app
            .post('/sessions/generate-week?weekStart=2026-10-11')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
    });
});
