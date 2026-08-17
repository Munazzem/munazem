import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../src/database/models/attendance-snapshot.model.js';
import { CycleEnrollmentModel } from '../../src/database/models/cycle-enrollment.model.js';
import { TransactionModel } from '../../src/database/models/transaction.model.js';
import { DailyLedgerModel } from '../../src/database/models/ledger.model.js';
import { PriceSettingsModel } from '../../src/database/models/price-settings.model.js';
import { seedTeacher, seedGroup, seedStudent, seedSession } from '../helpers/seed.helper.js';
import { GradeLevel, AttendanceStatus, SessionStatus } from '../../src/common/enums/enum.service.js';

describe('Completed Session Attendance Adjustment Integration', () => {
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
    });

    it('correctly adjusts completed session attendance from ABSENT to PRESENT', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Adjustable Student',
            gradeLevel: GradeLevel.SEC_1,
            consecutiveAbsences: 0
        });

        const session = await seedSession(group._id);
        // Complete session while student is not present -> marked ABSENT
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        let snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id }).lean();
        expect(snapshot?.absentCount).toBe(1);
        expect(snapshot?.presentCount).toBe(0);

        let studentDoc = await StudentModel.findById(student._id).lean();
        expect(studentDoc?.consecutiveAbsences).toBe(1);

        // Adjust completed session attendance to PRESENT
        const adjustResult = await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString(),
            'تصحيح حضور يدوي بعد انتهاء الحصة'
        );

        expect(adjustResult.success).toBe(true);

        // 1. Attendance Record is now PRESENT
        const attendanceRecord = await AttendanceModel.findOne({
            sessionId: session._id,
            studentId: student._id
        }).lean();
        expect(attendanceRecord?.status).toBe(AttendanceStatus.PRESENT);

        // 2. Snapshot is updated
        snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id }).lean();
        expect(snapshot?.absentCount).toBe(0);
        expect(snapshot?.presentCount).toBe(1);
        expect(snapshot?.presentStudents.some((s: any) => s.studentId.toString() === student._id.toString())).toBe(true);

        // 3. Consecutive absences decremented back to 0
        studentDoc = await StudentModel.findById(student._id).lean();
        expect(studentDoc?.consecutiveAbsences).toBe(0);

        // 4. Financial safety: No transactions created, no ledger modifications
        const txCount = await TransactionModel.countDocuments({ studentId: student._id });
        expect(txCount).toBe(0);
        const ledgerCount = await DailyLedgerModel.countDocuments({ teacherId: teacher._id });
        expect(ledgerCount).toBe(0);
    });

    it('is idempotent when adjusting to the same status repeatedly', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Idempotent Student',
            gradeLevel: GradeLevel.SEC_1
        });

        const session = await seedSession(group._id);
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        // First adjustment
        await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString()
        );

        // Second adjustment with same status
        const secondResult = await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString()
        );

        expect(secondResult.success).toBe(true);
        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id }).lean();
        expect(snapshot?.presentCount).toBe(1);
        expect(snapshot?.absentCount).toBe(0);
    });

    it('reverses adjustment from PRESENT back to ABSENT accurately', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Reversible Student',
            gradeLevel: GradeLevel.SEC_1,
            consecutiveAbsences: 0
        });

        const session = await seedSession(group._id);
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        // Absent -> Present
        await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString()
        );

        // Present -> Absent
        await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.ABSENT,
            teacher._id.toString(),
            teacher._id.toString()
        );

        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id }).lean();
        expect(snapshot?.presentCount).toBe(0);
        expect(snapshot?.absentCount).toBe(1);

        const studentDoc = await StudentModel.findById(student._id).lean();
        expect(studentDoc?.consecutiveAbsences).toBe(1);
    });
});
