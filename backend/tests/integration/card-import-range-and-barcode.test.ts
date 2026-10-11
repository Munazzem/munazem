/**
 * tests/integration/card-import-range-and-barcode.test.ts
 *
 * Tests for:
 * 1. POST /cards/import-range (range import, prefix, padding, duplicate skipping, limits)
 * 2. Multi-tenant isolation for cardNumber scoped to teacherId
 * 3. Barcode asterisk stripping and auto-linking during student creation
 * 4. CardsService.resolveCard with Code 39 barcode input (*10001* and 10001)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedGroup } from '../helpers/db.helper.js';
import { CardModel } from '../../src/database/models/card.model.js';
import { CardsService } from '../../src/modules/cards/cards.service.js';
import { StudentService } from '../../src/modules/students/students.service.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Card Range Import & Barcode Linking Integration Tests', () => {

    describe('1. Range Import API (POST /cards/import-range)', () => {
        it('يستورد نطاق كروت بنجاح ويسجلها بحالة NEW للمدرس', async () => {
            const teacher = await seedTeacher();
            const token = makeTeacherToken({ userId: teacher._id.toString() });

            const res = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({
                    startNumber: 10001,
                    endNumber: 10005,
                });

            expect(res.status).toBe(201);
            expect(res.body.data.totalRequested).toBe(5);
            expect(res.body.data.createdCount).toBe(5);
            expect(res.body.data.skippedCount).toBe(0);

            // Verify in DB
            const cards = await CardModel.find({ teacherId: teacher._id }).sort({ cardNumber: 1 });
            expect(cards.length).toBe(5);
            expect(cards[0].cardNumber).toBe('10001');
            expect(cards[4].cardNumber).toBe('10005');
            expect(cards.every(c => c.status === 'NEW')).toBe(true);
        });

        it('يتخطى الكروت المكررة عند استيراد نطاق متداخل', async () => {
            const teacher = await seedTeacher();
            const token = makeTeacherToken({ userId: teacher._id.toString() });

            // Import 10001 to 10003
            await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({ startNumber: 10001, endNumber: 10003 });

            // Now import 10002 to 10005 (10002, 10003 exist -> should be skipped)
            const res = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({ startNumber: 10002, endNumber: 10005 });

            expect(res.status).toBe(201);
            expect(res.body.data.totalRequested).toBe(4);
            expect(res.body.data.createdCount).toBe(2); // 10004, 10005
            expect(res.body.data.skippedCount).toBe(2); // 10002, 10003

            const total = await CardModel.countDocuments({ teacherId: teacher._id });
            expect(total).toBe(5);
        });

        it('يدعم البادئة وحشو الأصفار (prefix & padding)', async () => {
            const teacher = await seedTeacher();
            const token = makeTeacherToken({ userId: teacher._id.toString() });

            const res = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({
                    startNumber: 1,
                    endNumber: 3,
                    prefix: 'A-',
                    padding: 4,
                });

            expect(res.status).toBe(201);
            expect(res.body.data.createdCount).toBe(3);

            const cards = await CardModel.find({ teacherId: teacher._id }).sort({ cardNumber: 1 });
            expect(cards[0].cardNumber).toBe('A-0001');
            expect(cards[1].cardNumber).toBe('A-0002');
            expect(cards[2].cardNumber).toBe('A-0003');
        });

        it('يرفض إذا كان رقم البداية أكبر من النهاية أو النطاق يتجاوز 5000', async () => {
            const teacher = await seedTeacher();
            const token = makeTeacherToken({ userId: teacher._id.toString() });

            const badRange = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({ startNumber: 200, endNumber: 100 });
            expect(badRange.status).toBe(400);

            const hugeRange = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(token))
                .send({ startNumber: 1, endNumber: 6000 });
            expect(hugeRange.status).toBe(400);
        });
    });

    describe('2. Multi-Tenant Card Scoping', () => {
        it('يمكن لمدرسين مختلفين امتلاك نفس أرقام الكروت دون تعارض', async () => {
            const teacherA = await seedTeacher();
            const teacherB = await seedTeacher({
                _id: new mongoose.Types.ObjectId(),
                phone: '01000000099',
            });

            const tokenA = makeTeacherToken({ userId: teacherA._id.toString() });
            const tokenB = makeTeacherToken({ userId: teacherB._id.toString() });

            const resA = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(tokenA))
                .send({ startNumber: 10001, endNumber: 10002 });
            expect(resA.status).toBe(201);

            const resB = await app
                .post('/cards/import-range')
                .set('Authorization', bearerHeader(tokenB))
                .send({ startNumber: 10001, endNumber: 10002 });
            expect(resB.status).toBe(201);
            expect(resB.body.data.createdCount).toBe(2);

            const countA = await CardModel.countDocuments({ teacherId: teacherA._id });
            const countB = await CardModel.countDocuments({ teacherId: teacherB._id });
            expect(countA).toBe(2);
            expect(countB).toBe(2);
        });
    });

    describe('3. Barcode Linking & Asterisk Normalization in Student Creation', () => {
        it('يربط كارت مستورد مسبقاً بالطالب وينظف علامات النجمة *10001*', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

            // Import card 10001
            await CardsService.importCardRange(teacher._id.toString(), {
                startNumber: 10001,
                endNumber: 10001,
            });

            // Create student with barcode with Code 39 asterisks: * 10001 *
            const student = await StudentService.createStudent(teacher._id.toString(), {
                groupId: group._id.toString(),
                gradeLevel: GradeLevel.SEC_1,
                fullName: 'أحمد محمود',
                studentPhone: '01012345678',
                parentPhone: '01087654321',
                barcode: '*10001*',
            } as any);

            // Barcode should be normalized to '10001'
            expect(student.barcode).toBe('10001');

            // Card in DB should now be LINKED
            const card = await CardModel.findOne({ cardNumber: '10001', teacherId: teacher._id });
            expect(card).toBeDefined();
            expect(card!.status).toBe('LINKED');
            expect(card!.studentId!.toString()).toBe(student._id.toString());
        });

        it('ينشئ كارت تلقائياً (Self-healing) ويربطه إذا لم يكن الكارت مستورداً مسبقاً', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

            // Create student with barcode that was NOT pre-imported
            const student = await StudentService.createStudent(teacher._id.toString(), {
                groupId: group._id.toString(),
                gradeLevel: GradeLevel.SEC_1,
                fullName: 'محمد سعيد',
                studentPhone: '01112345678',
                parentPhone: '01187654321',
                barcode: '*77889*',
            } as any);

            expect(student.barcode).toBe('77889');

            // Card should be auto-created in CardModel and linked
            const card = await CardModel.findOne({ cardNumber: '77889', teacherId: teacher._id });
            expect(card).toBeDefined();
            expect(card!.status).toBe('LINKED');
            expect(card!.studentId!.toString()).toBe(student._id.toString());
        });
    });

    describe('4. CardsService.resolveCard with Code 39 Barcode', () => {
        it('يتعرف على الكارت المربوط بالطالب عند فحص *10001* بالباركود', async () => {
            const teacher = await seedTeacher();
            const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

            await StudentService.createStudent(teacher._id.toString(), {
                groupId: group._id.toString(),
                gradeLevel: GradeLevel.SEC_1,
                fullName: 'ياسر كمال',
                studentPhone: '01212345678',
                parentPhone: '01287654321',
                barcode: '10001',
            } as any);

            // Resolve with raw Code 39 asterisks
            const resolved = await CardsService.resolveCard('*10001*', teacher._id.toString());
            expect(resolved.cardNumber).toBe('10001');
            expect(resolved.cardStatus).toBe('LINKED');
            expect(resolved.student).toBeDefined();
            expect(resolved.student!.studentName).toBe('ياسر كمال');
        });
    });
});
