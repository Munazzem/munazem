/**
 * tests/integration/new-features-and-fixes.test.ts
 *
 * Comprehensive integration tests for recent updates:
 * 1. Batch delete transactions and cycle enrollment reversal (students marked unpaid).
 * 2. Cycle capacity update for ALL grades & proportional cycleCharge recalculation.
 * 3. Batch notebook sale with stock validation and ledger updates.
 * 4. Batch notebook reservation with custom date and deposit.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedGroup, seedStudent, seedNotebook } from '../helpers/db.helper.js';
import { GradeLevel, TransactionCategory, CycleEnrollmentStatus } from '../../src/common/enums/enum.service.js';
import { TransactionModel } from '../../src/database/models/transaction.model.js';
import { DailyLedgerModel } from '../../src/database/models/ledger.model.js';
import { CycleEnrollmentModel } from '../../src/database/models/cycle-enrollment.model.js';
import { NotebookModel } from '../../src/database/models/notebook.model.js';
import { NotebookReservationModel } from '../../src/database/models/notebook-reservation.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { StudentService } from '../../src/modules/students/students.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Recent Fixes and Features Integration Tests', () => {

    // ─── 1. Batch Delete Reversal ─────────────────────────────────────────
    describe('1. Batch Delete Transactions & Unpaid Status Reversal', () => {
        it('يمسح المعاملات ويعكس حالة اشتراك الطلاب ويجعلهم غير مشتركين', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1, customPrice: 200 });
            const s1 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
            const s2 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

            // Record batch subscription
            const subRes = await app
                .post('/payments/subscription/batch')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    studentIds: [s1._id.toString(), s2._id.toString()],
                });

            expect(subRes.status).toBe(201);
            expect(subRes.body.data.successCount).toBe(2);

            // Verify both students are currently PAID
            let paidStudentIds = await StudentService.getPaidStudentIds(teacher._id.toString());
            expect(paidStudentIds).toContain(s1._id.toString());
            expect(paidStudentIds).toContain(s2._id.toString());

            // Fetch transaction IDs created
            const txs = await TransactionModel.find({ teacherId: teacher._id }).lean();
            expect(txs.length).toBe(2);
            const txIds = txs.map(t => t._id.toString());

            // Perform batch deletion
            const delRes = await app
                .post('/payments/batch-delete')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    transactionIds: txIds,
                });

            expect(delRes.status).toBe(200);
            expect(delRes.body.data.deletedCount).toBe(2);

            // Transactions should be deleted
            const remainingTxs = await TransactionModel.find({ teacherId: teacher._id }).lean();
            expect(remainingTxs.length).toBe(0);

            // Cycle enrollments should be reversed / deleted
            const enrollments = await CycleEnrollmentModel.find({ teacherId: teacher._id }).lean();
            expect(enrollments.length).toBe(0);

            // Check getPaidStudentIds: Students must now be UNPAID
            paidStudentIds = await StudentService.getPaidStudentIds(teacher._id.toString());
            expect(paidStudentIds).not.toContain(s1._id.toString());
            expect(paidStudentIds).not.toContain(s2._id.toString());
        });
    });

    // ─── 2. Cycle Capacity & Proportional Price Update ───────────────────
    describe('2. Cycle Capacity Update & Proportional Price Recalculation', () => {
        it('يحدث حصص الدورة لجميع المراحل ويحسب سعر الاشتراك بالتناسب (نصف شهر = 50%)', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_2,
                customPrice: 200, // 200 EGP for 8 sessions
            });
            const student = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_2 });

            // Record initial subscription for full month (200 EGP)
            await app
                .post('/payments/subscription')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    studentId: student._id.toString(),
                    paidAmount: 200,
                });

            let enrollment = await CycleEnrollmentModel.findOne({ studentId: student._id }).lean();
            expect(enrollment?.cycleCharge).toBe(200);
            expect(enrollment?.cycleCapacity).toBe(8);

            // Teacher updates cycle capacity to 4 sessions for ALL grades
            const updateRes = await app
                .put('/groups/grade-cycle-capacity')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    gradeLevel: 'ALL',
                    cycleCapacity: 4,
                });

            expect(updateRes.status).toBe(200);

            // Verify group updated
            const updatedGroup = await GroupModel.findById(group._id).lean();
            expect(updatedGroup?.cycle?.capacity).toBe(4);

            // Verify enrollment updated with proportional price (4 sessions @ 25 EGP/session = 100 EGP)
            enrollment = await CycleEnrollmentModel.findOne({ studentId: student._id }).lean();
            expect(enrollment?.cycleCapacity).toBe(4);
            expect(enrollment?.cycleCharge).toBe(100);
            expect(enrollment?.status).toBe(CycleEnrollmentStatus.PAID);
        });
    });

    // ─── 3. Batch Notebook Sale ───────────────────────────────────────────
    describe('3. Batch Notebook Sale', () => {
        it('يسجل بيع مذكرات جماعي ويخصم المخزون ويسجل حركة الخزينة لكل طالب', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_3 });
            const s1 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_3 });
            const s2 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_3 });
            const s3 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_3 });

            const notebook = await seedNotebook({
                teacherId: teacher._id,
                name: 'مذكرة المراجعة النهائية',
                price: 50,
                stock: 10,
            });

            // Batch sell 2 copies per student for 3 students (total 6 copies = 300 EGP)
            const sellRes = await app
                .post('/payments/notebook/batch')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    notebookId: notebook._id.toString(),
                    studentIds: [s1._id.toString(), s2._id.toString(), s3._id.toString()],
                    quantity: 2,
                    date: '2026-08-20',
                });

            expect(sellRes.status).toBe(201);
            expect(sellRes.body.data.successCount).toBe(3);
            expect(sellRes.body.data.totalPaid).toBe(300);

            // Verify stock reduced by 6 (10 - 6 = 4)
            const updatedNotebook = await NotebookModel.findById(notebook._id).lean();
            expect(updatedNotebook?.stock).toBe(4);

            // Verify 3 transactions created
            const txs = await TransactionModel.find({
                teacherId: teacher._id,
                category: TransactionCategory.NOTEBOOK_SALE,
            }).lean();
            expect(txs.length).toBe(3);

            // Insufficient stock test: trying to sell 2 copies each to 3 students requires 6 copies, but only 4 left
            const overRes = await app
                .post('/payments/notebook/batch')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    notebookId: notebook._id.toString(),
                    studentIds: [s1._id.toString(), s2._id.toString(), s3._id.toString()],
                    quantity: 2,
                });

            expect(overRes.status).toBe(400);
            expect(overRes.body.message).toContain('غير كافية');
        });
    });

    // ─── 4. Batch Notebook Reservation ────────────────────────────────────
    describe('4. Batch Notebook Reservation with Deposit & Date', () => {
        it('يسجل حجز مذكرات جماعي مع دفع عربون اختياري وتاريخ مخصص', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.PREP_3 });
            const s1 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.PREP_3 });
            const s2 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.PREP_3 });

            const notebook = await seedNotebook({
                teacherId: teacher._id,
                name: 'مذكرة الشرح ترم أول',
                price: 80,
                stock: 20,
            });

            const reserveRes = await app
                .post('/payments/notebook/reserve/batch')
                .set('Authorization', bearerHeader(makeTeacherToken({ userId: teacher._id.toString() })))
                .send({
                    notebookId: notebook._id.toString(),
                    studentIds: [s1._id.toString(), s2._id.toString()],
                    quantity: 1,
                    paidAmount: 30, // 30 EGP deposit per student
                    date: '2026-08-15',
                });

            expect(reserveRes.status).toBe(201);
            expect(reserveRes.body.data.successCount).toBe(2);
            expect(reserveRes.body.data.totalPaid).toBe(60);

            // Verify notebook reservedCount increased by 2
            const updatedNotebook = await NotebookModel.findById(notebook._id).lean();
            expect(updatedNotebook?.reservedCount).toBe(2);

            // Verify 2 reservations created with status PENDING
            const reservations = await NotebookReservationModel.find({ teacherId: teacher._id }).lean();
            expect(reservations.length).toBe(2);
            expect(reservations.every(r => r.status === 'PENDING')).toBe(true);
            expect(reservations.every(r => r.paidAmount === 30)).toBe(true);

            // Verify 2 reservation deposit transactions created in income ledger
            const txs = await TransactionModel.find({
                teacherId: teacher._id,
                category: TransactionCategory.NOTEBOOK_RESERVATION,
            }).lean();
            expect(txs.length).toBe(2);
            expect(txs.every(t => t.paidAmount === 30)).toBe(true);
        });
    });
});
