/**
 * tests/integration/payments.api.test.ts
 *
 * Integration tests for the Payments module (Subscriptions, Notebooks, Expenses, Ledgers).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedStudent, seedNotebook } from '../helpers/db.helper.js';
import mongoose from 'mongoose';
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
            expect(res.body.data.paidAmount).toBe(75); // custom quota = 4 sessions, full price is 150 for 8 sessions, so 75.

            // Fetch cycle enrollment to verify chargeableSessions was updated
            const enrollmentModel = await mongoose.model('CycleEnrollment').findOne({ studentId: student._id });
            expect(enrollmentModel).not.toBeNull();
            expect(enrollmentModel.chargeableSessions).toBe(4);
            expect(enrollmentModel.cycleCharge).toBe(75);
        });

        it('يرمي خطأ 400 إذا لم يتم تحديد سعر للمجموعة ولا للمرحلة الدراسية', async () => {
            await seedTeacher();
            const group = await seedGroup(); // no customPrice
            const student = await seedStudent(group._id as any);
            // No PriceSettings configured

            const res = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 150
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('لم يتم تحديد سعر للمجموعة ولا للمرحلة الدراسية');
        });

        it('يطبق customPrice الخاص بالمجموعة كأولوية قصوى حتى مع وجود priceSnapshot أو PriceSettings', async () => {
            await seedTeacher();
            // Set up PriceSettings to 100
            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 100 }],
                    centerDiscounts: []
                });

            // Group has customPrice = 300
            const group = await seedGroup({ customPrice: 300 });
            // Add a mock priceSnapshot for PREP_1 = 200
            await mongoose.model('Group').findByIdAndUpdate(group._id, {
                cycle: {
                    startedAt: new Date(),
                    currentCycleNumber: 1,
                    currentSessionNumber: 0,
                    capacity: 8,
                    priceSnapshot: { PREP_1: 200 }
                }
            });

            const student = await seedStudent(group._id as any);

            const res = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 300
                });

            expect(res.status).toBe(201);
            expect(res.body.data.originalAmount).toBe(300); // cycleCharge should be based on 300
            
            const enrollmentModel = await mongoose.model('CycleEnrollment').findOne({ studentId: student._id });
            expect(enrollmentModel.fullCyclePrice).toBe(300);
            expect(enrollmentModel.cycleCharge).toBe(300);
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

    describe('DELETE /payments/:id', () => {
        it('Scenario A: Deleting a subscription on a newly created cycle enrollment correctly reverts student totalDebt to 0 and removes the enrollment', async () => {
            await seedTeacher();
            
            // Set base price to 100
            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 100 }],
                    centerDiscounts: []
                });

            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            // Record a partial payment (e.g. 40 out of 100) -> totalDebt should be 100 - 40 = 60
            const subRes = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 40
                });

            expect(subRes.status).toBe(201);
            const transactionId = subRes.body.data._id;

            let updatedStudent = await mongoose.model('Student').findById(student._id);
            expect(updatedStudent.totalDebt).toBe(60);

            // Delete the transaction
            const delRes = await app
                .delete(`/payments/${transactionId}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(delRes.status).toBe(200);

            // Verify the student debt is back to 0
            updatedStudent = await mongoose.model('Student').findById(student._id);
            expect(updatedStudent.totalDebt).toBe(0);

            // Verify the enrollment was completely deleted
            const enrollmentModel = await mongoose.model('CycleEnrollment').findOne({ studentId: student._id });
            expect(enrollmentModel).toBeNull();
        });

        it('Scenario B: Deleting a secondary/partial payment transaction on an existing enrollment correctly restores paidAmount back to student.totalDebt', async () => {
            await seedTeacher();
            
            await app
                .put('/payments/prices')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    prices: [{ gradeLevel: GradeLevel.PREP_1, amount: 200 }],
                    centerDiscounts: []
                });

            const group = await seedGroup();
            const student = await seedStudent(group._id as any);

            // First payment of 50 -> debt is 200 - 50 = 150
            await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 50
                });

            // Second payment of 30 -> debt is 150 - 30 = 120
            const secondSubRes = await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 30
                });

            const transactionId = secondSubRes.body.data._id;

            let updatedStudent = await mongoose.model('Student').findById(student._id);
            expect(updatedStudent.totalDebt).toBe(120);

            // Delete the second payment only
            const delRes = await app
                .delete(`/payments/${transactionId}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(delRes.status).toBe(200);

            // Debt should increase by 30, returning to 150
            updatedStudent = await mongoose.model('Student').findById(student._id);
            expect(updatedStudent.totalDebt).toBe(150);

            // Enrollment should NOT be deleted, it should remain partially paid
            const enrollmentModel = await mongoose.model('CycleEnrollment').findOne({ studentId: student._id });
            expect(enrollmentModel).not.toBeNull();
            expect(enrollmentModel.totalPaid).toBe(50);
            expect(enrollmentModel.remainingAmount).toBe(150);
        });
    });

});
