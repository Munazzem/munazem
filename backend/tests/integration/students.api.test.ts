/**
 * tests/integration/students.api.test.ts
 *
 * Integration tests for the Students module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedStudent } from '../helpers/db.helper.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Students API', () => {

    describe('POST /students', () => {
        it('يُنشئ طالب جديد بنجاح', async () => {
            await seedTeacher();
            const group = await seedGroup();

            const res = await app
                .post('/students')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    fullName: 'طالب تجريبي جديد',
                    studentPhone: '01012345678',
                    parentPhone: '01087654321',
                    gradeLevel: GradeLevel.PREP_1,
                    groupId: group._id.toString()
                });

            expect(res.status).toBe(201);
            expect(res.body.data.studentName).toBe('طالب تجريبي جديد');
            expect(res.body.data.groupId).toBe(group._id.toString());
        });

        it('Assistant يمكنه إضافة طالب للمدرس', async () => {
            await seedTeacher();
            await seedAssistant();
            const group = await seedGroup();

            const res = await app
                .post('/students')
                .set('Authorization', bearerHeader(makeAssistantToken()))
                .send({
                    fullName: 'طالب مضاف بواسطة المساعد',
                    studentPhone: '01112345678',
                    parentPhone: '01187654321',
                    gradeLevel: GradeLevel.PREP_1,
                    groupId: group._id.toString()
                });

            expect(res.status).toBe(201);
        });

        it('يرفض الإضافة بـ 400 إذا كانت البيانات ناقصة', async () => {
            await seedTeacher();
            const res = await app
                .post('/students')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    fullName: 'قصير', // أقل من 5
                    studentPhone: '123'
                });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /students/bulk', () => {
        it('يُضيف قائمة طلاب دفعة واحدة بنجاح', async () => {
            await seedTeacher();
            const group = await seedGroup();

            const res = await app
                .post('/students/bulk')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    students: [
                        {
                            fullName: 'الطالب الأول',
                            studentPhone: '01011111111',
                            parentPhone: '01022222222',
                            gradeLevel: GradeLevel.PREP_1,
                            groupId: group._id.toString()
                        },
                        {
                            fullName: 'الطالب الثاني',
                            studentPhone: '01033333333',
                            parentPhone: '01044444444',
                            gradeLevel: GradeLevel.PREP_1,
                            groupId: group._id.toString()
                        }
                    ]
                });

            expect(res.status).toBe(201);
            expect(res.body.data.successCount).toBe(2);
        });
    });

    describe('GET /students', () => {
        it('يجلب قائمة الطلاب مع التصفح (Pagination)', async () => {
            await seedTeacher();
            const group = await seedGroup();
            await seedStudent(group._id as any, { studentName: 'أحمد', parentName: 'محمود', studentCode: '1A' });
            await seedStudent(group._id as any, { studentName: 'محمد', parentName: 'سعيد', studentCode: '1B' });

            const res = await app
                .get('/students?page=1&limit=10')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.data.length).toBe(2);
        });
    });

    describe('GET /students/:id', () => {
        it('يجلب بيانات الطالب المطلوب بنجاح', async () => {
            await seedTeacher();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            const res = await app
                .get(`/students/${student._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data._id).toBe(student._id.toString());
        });

        it('يرجع 404 إذا كان الطالب غير موجود', async () => {
            await seedTeacher();
            const res = await app
                .get(`/students/6a6cbd60e0becff1f643fbb1`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /students/:id', () => {
        it('يُحدّث بيانات الطالب بنجاح', async () => {
            await seedTeacher();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            const res = await app
                .put(`/students/${student._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    fullName: 'الاسم الجديد للطالب',
                    studentPhone: '01555555555'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.studentName).toBe('الاسم الجديد للطالب');
        });
    });

    describe('DELETE /students/:id', () => {
        it('يحذف الطالب بنجاح ويرجع 200', async () => {
            await seedTeacher();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            const res = await app
                .delete(`/students/${student._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
        });
    });

    describe('GET /students/group/:groupId/cards', () => {
        it('يُصدر بطاقات المجموعة بنجاح ويرجع HTML', async () => {
            await seedTeacher();
            const group = await seedGroup();
            await seedStudent(group._id as any);

            const res = await app
                .get(`/students/group/${group._id}/cards`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('text/html');
        });
    });

});
