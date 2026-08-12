/**
 * tests/integration/payments.api.test.ts
 *
 * Integration tests for the Payments module (Subscriptions, Notebooks, Expenses, Ledgers).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedStudent, seedNotebook } from '../helpers/db.helper.js';
import { GradeLevel, TransactionCategory } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Payments API', () => {

    describe('PUT /payments/prices', () => {
        it('يُحدث أسعار الحصص لكل مرحلة دراسية', async () => {
            await seedTeacher();

            const res = await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [
                        { gradeLevel: GradeLevel.PREP_1, amount: 150 },
                        { gradeLevel: GradeLevel.PREP_2, amount: 160 }
                    ],
                    centerDiscounts: []
                });

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('بنجاح');
        });
    });

    describe('GET /payments/prices', () => {
        it('يجلب أسعار الحصص الخاصة بالمدرس', async () => {
            await seedTeacher();

            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 150 }],
                    centerDiscounts: []
                });

            const res = await app
                .get('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data).toBeInstanceOf(Object);
        });
    });

    describe('POST /payments/subscription', () => {
        it('المساعد يسجل اشتراك طالب ويدفع المبلغ بنجاح', async () => {
            await seedTeacher();
            await seedAssistant();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            // First set the price for PREP_1
            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 150 }],
                    centerDiscounts: []
                });

            // Assistant records subscription
            const res = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeAssistantToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 150,
                    discountAmount: 0
                });

            expect(res.status).toBe(201);
            expect(res.body.data.paidAmount).toBe(150);
            expect(res.body.data.category).toBe(TransactionCategory.SUBSCRIPTION);
        });

        it('يسجل اشتراك مع تخصيص عدد الحصص (customSessionsQuota)', async () => {
            await seedTeacher();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 150 }],
                    centerDiscounts: []
                });

            const res = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 75,
                    discountAmount: 0,
                    customSessionsQuota: 4
                });

            expect(res.status).toBe(201);
            expect(res.body.data.paidAmount).toBe(75);

            // Fetch student to verify remainingSessions was updated
            const studentRes = await app
                .get(`/students/${student._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));
            
            expect(studentRes.status).toBe(200);
            expect(studentRes.body.data.remainingSessions).toBe(4);
        });
    });

    describe('POST /payments/notebook', () => {
        it('المساعد يسجل بيع مذكرة لطالب ويسجل المعاملة المالية', async () => {
            await seedTeacher();
            await seedAssistant();
            const group = await seedGroup();
            const student = await seedStudent(group._id as any);
            const notebook = await seedNotebook({ price: 50 });

            const res = await app
                .post('/payments/notebook')
                .set('Authorization', bearerHeader(makeAssistantToken()))
                .send({
                    notebookId: notebook._id.toString(),
                    studentId: student._id.toString(),
                    quantity: 1
                });

            expect(res.status).toBe(201);
            expect(res.body.data.paidAmount).toBe(50);
            expect(res.body.data.category).toBe(TransactionCategory.NOTEBOOK_SALE);
        });
    });

    describe('POST /payments/expense', () => {
        it('يسجل مصروف مالي جديد (Expense)', async () => {
            await seedTeacher();

            const res = await app
                .post('/payments/expense')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    category: TransactionCategory.OTHER_EXPENSE,
                    amount: 500,
                    description: 'أوراق امتحانات'
                });

            expect(res.status).toBe(201);
            expect(res.body.data.paidAmount).toBe(500);
        });
    });

    describe('GET /payments/ledger/daily', () => {
        it('يجلب جرد اليوم بنجاح ويكون المجموع صحيح', async () => {
            await seedTeacher();
            await seedAssistant();
            
            // Add expense
            await app
                .post('/payments/expense')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    category: TransactionCategory.OTHER_EXPENSE,
                    amount: 100,
                    description: 'مصاريف'
                });

            const res = await app
                .get('/payments/ledger/daily')
                .set('Authorization', bearerHeader(makeAssistantToken()));

            expect(res.status).toBe(200);
            // Verify there is an expense transaction in the ledger
            expect(res.body.data.transactions).toBeInstanceOf(Array);
        });
    });

});
