/**
 * tests/integration/users.api.test.ts
 *
 * Integration tests for the Users module (Teacher/Assistant management).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, bearerHeader, TEST_IDS } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant } from '../helpers/db.helper.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Users API', () => {

    describe('POST /users', () => {
        it('Teacher يمكنه إنشاء حساب مساعد (Assistant) بنجاح', async () => {
            await seedTeacher();

            const res = await app
                .post('/users')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    name: 'مساعد جديد',
                    phone: '01011223344',
                    password: 'password123',
                    salary: 1500
                });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('مساعد جديد');
            expect(res.body.data.role).toBe('assistant');
            expect(res.body.data.teacherId).toBe(TEST_IDS.teacher.toString());
        });

        it('يرفض الإضافة بـ 400 لو كلمة المرور قصيرة', async () => {
            await seedTeacher();

            const res = await app
                .post('/users')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    name: 'مساعد جديد',
                    phone: '01011223344',
                    password: '123' // too short
                });

            expect(res.status).toBe(400);
        });
    });

    describe('GET /users', () => {
        it('Teacher يجلب قائمة المساعدين التابعين له', async () => {
            await seedTeacher();
            await seedAssistant(); // belongs to this teacher

            const res = await app
                .get('/users')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].role).toBe('assistant');
        });
    });

    describe('PUT /users/:id', () => {
        it('Teacher يمكنه تعديل بيانات المساعد', async () => {
            await seedTeacher();
            const assistant = await seedAssistant();

            const res = await app
                .put(`/users/${assistant._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    name: 'اسم المساعد المعدل',
                    salary: 2000
                });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('اسم المساعد المعدل');
            expect(res.body.data.salary).toBe(2000);
        });
    });

    describe('DELETE /users/:id', () => {
        it('Teacher يمكنه حذف حساب المساعد', async () => {
            await seedTeacher();
            const assistant = await seedAssistant();

            const res = await app
                .delete(`/users/${assistant._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('بنجاح');
        });
    });

    describe('POST /users/:id/pay-salary', () => {
        it('Teacher يمكنه دفع راتب للمساعد ويسجل حركة مالية', async () => {
            await seedTeacher();
            const assistant = await seedAssistant();

            const res = await app
                .post(`/users/${assistant._id}/pay-salary`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    amount: 1000,
                    notes: 'راتب شهر 10'
                });

            expect(res.status).toBe(201);
            expect(res.body.message).toContain('بنجاح');
            expect(res.body.data.paidAmount).toBe(1000);
        });
    });

});
