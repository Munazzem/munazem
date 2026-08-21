import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { PaymentsService } from '../../src/modules/payments/payments.service.js';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../src/database/models/attendance-snapshot.model.js';
import { PriceSettingsModel } from '../../src/database/models/price-settings.model.js';
import { CycleEnrollmentModel } from '../../src/database/models/cycle-enrollment.model.js';
import { seedTeacher, seedGroup, seedStudent, seedSession, seedAttendance } from '../helpers/seed.helper.js';
import { GradeLevel, CycleEnrollmentStatus, AttendanceStatus } from '../../src/common/enums/enum.service.js';

describe('Cycle-Based Billing Integration', () => {
    let teacher: any;
    let group: any;

    beforeEach(async () => {
        teacher = await seedTeacher();
        
        await PriceSettingsModel.create({
            teacherId: teacher._id,
            prices: [{ gradeLevel: GradeLevel.SEC_1, amount: 800 }]
        });

        group = await seedGroup({
            teacherId: teacher._id,
            schedule: [{ day: 'السبت', time: '10:00' }, { day: 'الثلاثاء', time: '10:00' }]
        });
        // cycleCapacity = 8 (2 * 4)
    });

    it('creates cycle enrollment for active students on cycle rollover and increments debt', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Rollover Student',
            gradeLevel: GradeLevel.SEC_1,
            totalDebt: 0
        });

        // Current cycle is 1, session 0.
        // We will simulate 8 sessions to trigger rollover.
        for (let i = 1; i <= 8; i++) {
            const session = await seedSession(group._id);
            await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());
        }

        let updatedGroup = await GroupModel.findById(group._id).lean();
        expect(updatedGroup?.cycle?.currentCycleNumber).toBe(1);
        expect(updatedGroup?.cycle?.currentSessionNumber).toBe(8);

        // Now session 9 -> Rolls over to cycle 2, session 1
        const rolloverSession = await seedSession(group._id);
        await AttendanceService.completeSession(rolloverSession._id.toString(), teacher._id.toString());

        updatedGroup = await GroupModel.findById(group._id).lean();
        expect(updatedGroup?.cycle?.currentCycleNumber).toBe(2);
        expect(updatedGroup?.cycle?.currentSessionNumber).toBe(1);

        // Check if CycleEnrollment was created for cycle 2
        const enrollment = await CycleEnrollmentModel.findOne({
            studentId: student._id,
            cycleNumber: 2
        }).lean();

        expect(enrollment).toBeDefined();
        expect(enrollment?.cycleCharge).toBe(800); // 8 sessions * 100
        expect(enrollment?.status).toBe(CycleEnrollmentStatus.UNPAID);

        // Check if debt was incremented for both cycle 1 and cycle 2 (800 + 800 = 1600)
        const updatedStudent = await StudentModel.findById(student._id).lean();
        expect(updatedStudent?.totalDebt).toBe(1600);
    });

    it('allocates debt payments using FIFO logic (Historical Debt first, then Cycles)', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Debt Student',
            gradeLevel: GradeLevel.SEC_1,
            totalDebt: 500 // Historical debt before cycle
        });

        // Set group to cycle 1, session 1
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.currentCycleNumber': 1,
                'cycle.currentSessionNumber': 1,
                'cycle.capacity': 8,
                'cycle.priceSnapshot': { [GradeLevel.SEC_1]: 800 }
            }
        });

        // Manually create two unpaid cycles (cycle 1 and cycle 2)
        await CycleEnrollmentModel.create([
            {
                studentId: student._id,
                groupId: group._id,
                teacherId: teacher._id,
                cycleNumber: 1,
                cycleCapacity: 8,
                pricePerSession: 100,
                fullCyclePrice: 800,
                startSession: 1,
                chargeableSessions: 8,
                cycleCharge: 800,
                totalPaid: 0,
                remainingAmount: 800,
                status: CycleEnrollmentStatus.UNPAID
            },
            {
                studentId: student._id,
                groupId: group._id,
                teacherId: teacher._id,
                cycleNumber: 2,
                cycleCapacity: 8,
                pricePerSession: 100,
                fullCyclePrice: 800,
                startSession: 1,
                chargeableSessions: 8,
                cycleCharge: 800,
                totalPaid: 0,
                remainingAmount: 800,
                status: CycleEnrollmentStatus.UNPAID
            }
        ]);

        // Student's total debt is 500 (historical) + 800 (cycle 1) + 800 (cycle 2) = 2100
        await StudentModel.findByIdAndUpdate(student._id, { $set: { totalDebt: 2100 } });

        // Pay 1500
        await PaymentsService.payDebt(teacher._id.toString(), teacher._id.toString(), {
            studentId: student._id.toString(),
            amount: 1500
        });

        const updatedStudent = await StudentModel.findById(student._id).lean();
        // 2100 - 1500 = 600
        expect(updatedStudent?.totalDebt).toBe(600);

        // How was it allocated?
        // 500 to historical -> remaining amount 1000
        // 800 to cycle 1 -> remaining amount 200 (Cycle 1 PAID)
        // 200 to cycle 2 -> Cycle 2 PARTIALLY_PAID, remaining amount = 600

        const cycle1 = await CycleEnrollmentModel.findOne({ studentId: student._id, cycleNumber: 1 }).lean();
        expect(cycle1?.status).toBe(CycleEnrollmentStatus.PAID);
        expect(cycle1?.remainingAmount).toBe(0);

        const cycle2 = await CycleEnrollmentModel.findOne({ studentId: student._id, cycleNumber: 2 }).lean();
        expect(cycle2?.status).toBe(CycleEnrollmentStatus.PARTIALLY_PAID);
        expect(cycle2?.remainingAmount).toBe(600);
    });

    it('marks student who attended as guest in another group as EXCUSED (compensated) in primary group', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Compensating Student',
            gradeLevel: GradeLevel.SEC_1,
            consecutiveAbsences: 0
        });

        const otherGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            schedule: [{ day: 'الأحد', time: '12:00' }]
        });

        // Student attends other group session as guest
        const otherSession = await seedSession(otherGroup._id);
        await AttendanceService.recordAttendance(teacher._id.toString(), {
            studentId: student._id.toString(),
            sessionId: otherSession._id.toString(),
            status: AttendanceStatus.PRESENT
        }, teacher._id.toString());

        // Now primary group session is completed
        const primarySession = await seedSession(group._id);
        await AttendanceService.completeSession(primarySession._id.toString(), teacher._id.toString());

        // Check attendance record for primary session
        const primaryAttendance = await AttendanceModel.findOne({
            studentId: student._id,
            sessionId: primarySession._id
        }).lean();

        expect(primaryAttendance).toBeDefined();
        expect(primaryAttendance?.status).toBe(AttendanceStatus.EXCUSED);
        expect(primaryAttendance?.notes).toContain('معوّض');

        // Check student's consecutive absences: should NOT increase
        const updatedStudent = await StudentModel.findById(student._id).lean();
        expect(updatedStudent?.consecutiveAbsences).toBe(0);
    });

    it('retroactively converts ABSENT to EXCUSED (compensated) when student compensates in another group after being marked absent', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Late Compensating Student',
            gradeLevel: GradeLevel.SEC_1,
            consecutiveAbsences: 0
        });

        const otherGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            schedule: [{ day: 'الثلاثاء', time: '14:00' }]
        });

        // 1. Primary group session completed FIRST -> student was not there and is marked ABSENT
        const primarySession = await seedSession(group._id);
        await AttendanceService.completeSession(primarySession._id.toString(), teacher._id.toString());

        let primaryAttendance = await AttendanceModel.findOne({
            studentId: student._id,
            sessionId: primarySession._id
        }).lean();

        expect(primaryAttendance?.status).toBe(AttendanceStatus.ABSENT);

        let studentDoc = await StudentModel.findById(student._id).lean();
        expect(studentDoc?.consecutiveAbsences).toBe(1);

        // 2. Student later attends another group as guest to compensate
        const otherSession = await seedSession(otherGroup._id);
        await AttendanceService.recordAttendance(teacher._id.toString(), {
            studentId: student._id.toString(),
            sessionId: otherSession._id.toString(),
            status: AttendanceStatus.PRESENT
        }, teacher._id.toString());

        // 3. Check that the past ABSENT record was converted to EXCUSED
        primaryAttendance = await AttendanceModel.findOne({
            studentId: student._id,
            sessionId: primarySession._id
        }).lean();

        expect(primaryAttendance?.status).toBe(AttendanceStatus.EXCUSED);
        expect(primaryAttendance?.notes).toContain('معوّض');

        // 4. Check that AttendanceSnapshotModel of primary session was synchronized (student removed from absentStudents)
        const primarySnapshot = await AttendanceSnapshotModel.findOne({ sessionId: primarySession._id }).lean();
        const isInAbsent = primarySnapshot?.absentStudents?.some(a => a.studentId.toString() === student._id.toString());
        expect(isInAbsent).toBe(false);

        // 5. Consecutive absences was decremented back to 0
        studentDoc = await StudentModel.findById(student._id).lean();
        expect(studentDoc?.consecutiveAbsences).toBe(0);

        // 6. Complete the other session and verify student report counts exactly 1 session
        await AttendanceService.completeSession(otherSession._id.toString(), teacher._id.toString());
        const report = await ReportsService.getStudentReport(student._id.toString(), teacher._id.toString());
        expect(report.attendance.presentCount).toBe(1);
        expect(report.attendance.absentCount).toBe(0);
        expect(report.attendance.totalSessions).toBe(1);
        expect(report.attendance.history.length).toBe(1);
        expect(report.attendance.history[0].status).toBe('GUEST');
    });

    it('correctly calculates pro-rata for new student joining after lesson 3 (chargeable = 5, starts at 4)', async () => {
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.currentCycleNumber': 1,
                'cycle.currentSessionNumber': 3, // 3 sessions completed
                'cycle.capacity': 8,
                'cycle.startedAt': new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                'cycle.priceSnapshot': { [GradeLevel.SEC_1]: 800 }
            }
        });

        const newStudent = await seedStudent(group._id, {
            studentName: 'Student After Lesson 3',
            gradeLevel: GradeLevel.SEC_1,
            createdAt: new Date()
        });

        const tx = await PaymentsService.recordSubscription(teacher._id.toString(), teacher._id.toString(), {
            studentId: newStudent._id.toString(),
            paidAmount: 500 // 5 sessions * 100 EGP
        });

        const enrollment = await CycleEnrollmentModel.findOne({
            studentId: newStudent._id,
            cycleNumber: 1
        }).lean();

        expect(enrollment?.startSession).toBe(4);
        expect(enrollment?.chargeableSessions).toBe(5);
        expect(enrollment?.cycleCharge).toBe(500);
        expect(enrollment?.status).toBe(CycleEnrollmentStatus.PAID);
    });

    it('correctly calculates pro-rata for new student joining after lesson 4 (chargeable = 4, starts at 5)', async () => {
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.currentCycleNumber': 1,
                'cycle.currentSessionNumber': 4, // 4 sessions completed
                'cycle.capacity': 8,
                'cycle.startedAt': new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
                'cycle.priceSnapshot': { [GradeLevel.SEC_1]: 800 }
            }
        });

        const newStudent = await seedStudent(group._id, {
            studentName: 'Student After Lesson 4',
            gradeLevel: GradeLevel.SEC_1,
            createdAt: new Date()
        });

        const tx = await PaymentsService.recordSubscription(teacher._id.toString(), teacher._id.toString(), {
            studentId: newStudent._id.toString(),
            paidAmount: 400 // 4 sessions * 100 EGP
        });

        const enrollment = await CycleEnrollmentModel.findOne({
            studentId: newStudent._id,
            cycleNumber: 1
        }).lean();

        expect(enrollment?.startSession).toBe(5);
        expect(enrollment?.chargeableSessions).toBe(4);
        expect(enrollment?.cycleCharge).toBe(400);
        expect(enrollment?.status).toBe(CycleEnrollmentStatus.PAID);
    });

    it('correctly calculates pro-rata for new student joining after lesson 7 (chargeable = 1, starts at 8)', async () => {
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.currentCycleNumber': 1,
                'cycle.currentSessionNumber': 7, // 7 sessions completed
                'cycle.capacity': 8,
                'cycle.startedAt': new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
                'cycle.priceSnapshot': { [GradeLevel.SEC_1]: 800 }
            }
        });

        const newStudent = await seedStudent(group._id, {
            studentName: 'Student After Lesson 7',
            gradeLevel: GradeLevel.SEC_1,
            createdAt: new Date()
        });

        const tx = await PaymentsService.recordSubscription(teacher._id.toString(), teacher._id.toString(), {
            studentId: newStudent._id.toString(),
            paidAmount: 100 // 1 session * 100 EGP
        });

        const enrollment = await CycleEnrollmentModel.findOne({
            studentId: newStudent._id,
            cycleNumber: 1
        }).lean();

        expect(enrollment?.startSession).toBe(8);
        expect(enrollment?.chargeableSessions).toBe(1);
        expect(enrollment?.cycleCharge).toBe(100);
        expect(enrollment?.status).toBe(CycleEnrollmentStatus.PAID);
    });

    it('handles custom cycle capacity (6 lessons = 600 EGP -> 100/lesson) and custom quota', async () => {
        const customGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            cycle: { capacity: 6, currentCycleNumber: 1, currentSessionNumber: 0 },
            schedule: [{ day: 'الأحد', time: '12:00' }]
        });

        await PriceSettingsModel.findOneAndUpdate(
            { teacherId: teacher._id },
            { $set: { prices: [{ gradeLevel: GradeLevel.SEC_1, amount: 600 }] } }
        );

        const student = await seedStudent(customGroup._id, {
            studentName: 'Custom Cycle Student',
            gradeLevel: GradeLevel.SEC_1
        });

        // 1. Full cycle payment (6 lessons = 600 EGP)
        const txFull = await PaymentsService.recordSubscription(teacher._id.toString(), teacher._id.toString(), {
            studentId: student._id.toString(),
            paidAmount: 600
        });

        let enrollment = await CycleEnrollmentModel.findOne({
            studentId: student._id,
            cycleNumber: 1
        }).lean();

        expect(enrollment?.cycleCapacity).toBe(6);
        expect(enrollment?.pricePerSession).toBe(100);
        expect(enrollment?.cycleCharge).toBe(600);
        expect(enrollment?.status).toBe(CycleEnrollmentStatus.PAID);

        // 2. Custom Quota (Half cycle = 3 lessons -> 300 EGP) for another student
        const student2 = await seedStudent(customGroup._id, {
            studentName: 'Half Cycle Student',
            gradeLevel: GradeLevel.SEC_1
        });

        const txHalf = await PaymentsService.recordSubscription(teacher._id.toString(), teacher._id.toString(), {
            studentId: student2._id.toString(),
            customSessionsQuota: 3,
            paidAmount: 300
        });

        const enrollment2 = await CycleEnrollmentModel.findOne({
            studentId: student2._id,
            cycleNumber: 1
        }).lean();

        expect(enrollment2?.chargeableSessions).toBe(3);
        expect(enrollment2?.cycleCharge).toBe(300);
        expect(enrollment2?.status).toBe(CycleEnrollmentStatus.PAID);
    });
});
