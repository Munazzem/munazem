/**
 * tests/integration/exams.api.test.ts
 *
 * Integration tests for the Exams module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedStudent } from '../helpers/db.helper.js';
import { GradeLevel, QuestionType, ExamStatus } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Exams API', () => {

    describe('POST /exams', () => {
        it('Teacher يمكنه إنشاء امتحان جديد بنجاح', async () => {
            await seedTeacher();

            const res = await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان الشهر الأول',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5,
                    questions: [
                        {
                            type: QuestionType.MCQ,
                            text: 'ما هي عاصمة مصر؟',
                            marks: 10,
                            options: ['القاهرة', 'الأسكندرية', 'الجيزة'],
                            correctAnswer: 'القاهرة'
                        }
                    ]
                });

            expect(res.status).toBe(201);
            expect(res.body.data.title).toBe('امتحان الشهر الأول');
            expect(res.body.data.status).toBe(ExamStatus.DRAFT);
        });
    });

    describe('GET /exams', () => {
        it('يجلب قائمة الامتحانات التابعة للمدرس', async () => {
            await seedTeacher();
            
            // Create an exam first
            await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان الشهر الأول',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5
                });

            const res = await app
                .get('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('GET /exams/:id', () => {
        it('يجلب بيانات امتحان محدد بنجاح', async () => {
            await seedTeacher();

            const examRes = await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان الشهر الثاني',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5
                });
            const examId = examRes.body.data._id;

            const res = await app
                .get(`/exams/${examId}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.title).toBe('امتحان الشهر الثاني');
        });
    });

    describe('PATCH /exams/:id/publish', () => {
        it('ينشر الامتحان ويحول حالته إلى PUBLISHED', async () => {
            await seedTeacher();

            const examRes = await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان الشهر الثالث',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5
                });
            const examId = examRes.body.data._id;

            const res = await app
                .patch(`/exams/${examId}/publish`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe(ExamStatus.PUBLISHED);
        });
    });

    describe('POST /exams/:id/results', () => {
        it('يسجل درجة طالب في امتحان منشور', async () => {
            await seedTeacher();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            const examRes = await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان الشهر الثالث',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5
                });
            const examId = examRes.body.data._id;

            // Publish exam first
            await app
                .patch(`/exams/${examId}/publish`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            const res = await app
                .post(`/exams/${examId}/results`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    score: 9
                });

            expect(res.status).toBe(201);
            expect(res.body.data.score).toBe(9);
        });
    });

    describe('DELETE /exams/:id', () => {
        it('يحذف امتحان Draft بنجاح', async () => {
            await seedTeacher();

            const examRes = await app
                .post('/exams')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    title: 'امتحان للحذف',
                    date: new Date().toISOString(),
                    gradeLevel: GradeLevel.PREP_1,
                    totalMarks: 10,
                    passingMarks: 5
                });
            const examId = examRes.body.data._id;

            const res = await app
                .delete(`/exams/${examId}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
        });
    });

});
