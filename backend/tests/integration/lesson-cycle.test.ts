import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../src/database/models/attendance-snapshot.model.js';
import { seedTeacher, seedGroup, seedStudent, seedSession, seedAttendance } from '../helpers/seed.helper.js';
import { SessionStatus, AttendanceStatus } from '../../src/common/enums/enum.service.js';
import { TEST_IDS } from '../helpers/auth.helper.js';

describe('Lesson Cycle Redesign - completeSession', () => {
    let teacher: any;
    let group: any;

    beforeEach(async () => {
        teacher = await seedTeacher();
        group = await seedGroup({
            teacherId: teacher._id,
            schedule: [{ day: 'السبت', time: '10:00' }, { day: 'الثلاثاء', time: '10:00' }]
        });
        // cycleCapacity for this group is 2 * 4 = 8
    });

    it('decrements remainingSessions for both present and absent students, but NOT excused', async () => {
        const studentPresent = await seedStudent(group._id, {
            studentName: 'Present Student',
            studentPhone: '01000000001',
            studentCode: '1A',
            remainingSessions: 5,
            cycleCapacity: 8,
            cycleNumber: 1
        });
        const studentAbsent = await seedStudent(group._id, {
            studentName: 'Absent Student',
            studentPhone: '01000000002',
            studentCode: '2A',
            remainingSessions: 5,
            cycleCapacity: 8,
            cycleNumber: 1
        });
        const studentExcused = await seedStudent(group._id, {
            studentName: 'Excused Student',
            studentPhone: '01000000003',
            studentCode: '3A',
            remainingSessions: 5,
            cycleCapacity: 8,
            cycleNumber: 1,
            excusedSessionsCount: 1 // Pre-excused
        });

        const session = await seedSession(group._id);

        // Mark only studentPresent as PRESENT
        await seedAttendance(session._id, studentPresent._id, { status: AttendanceStatus.PRESENT });
        // Absent is not marked (so attendance service considers them absent)
        // Excused is excused by count

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const afterPresent = await StudentModel.findById(studentPresent._id).lean();
        const afterAbsent = await StudentModel.findById(studentAbsent._id).lean();
        const afterExcused = await StudentModel.findById(studentExcused._id).lean();

        // Should be decremented
        expect(afterPresent?.remainingSessions).toBe(4);
        expect(afterAbsent?.remainingSessions).toBe(4);
        
        // Should NOT be decremented
        expect(afterExcused?.remainingSessions).toBe(5);
        expect(afterExcused?.excusedSessionsCount).toBe(0); // excuse count used up
    });

    it('auto-resets cycle when remainingSessions reaches 0 after consumption', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Zero Student',
            studentPhone: '01000000010',
            studentCode: '10A',
            remainingSessions: 1, // exactly 1 left
            cycleCapacity: 8,
            cycleNumber: 1,
            cycleStartedAt: new Date('2025-01-01')
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, student._id, { status: AttendanceStatus.PRESENT });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const after = await StudentModel.findById(student._id).lean();
        
        // Cycle should have reset
        expect(after?.remainingSessions).toBe(8); // new cycle capacity
        expect(after?.cycleCapacity).toBe(8);
        expect(after?.cycleNumber).toBe(2);
        expect(after?.cycleStartedAt).not.toBeNull();
        expect(after?.cycleStartedAt?.getTime()).toBeGreaterThan(new Date('2025-01-01').getTime());
    });

    it('ensures current session belongs to old cycle, new cycle starts AFTER', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Boundary Student',
            studentPhone: '01000000011',
            studentCode: '11A',
            remainingSessions: 1, // 1 left
            cycleCapacity: 8,
            cycleNumber: 1
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, student._id, { status: AttendanceStatus.PRESENT });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const after = await StudentModel.findById(student._id).lean();
        // Since it had 1 left, the session consumes it to 0.
        // Then auto-reset sets it to 8.
        // It should NOT be 7 (which would mean consumed from new cycle).
        expect(after?.remainingSessions).toBe(8); 
        expect(after?.cycleNumber).toBe(2);
    });

    it('cycle reset is idempotent (prevents negative or multiple resets)', async () => {
        const student = await seedStudent(group._id, {
            studentName: 'Negative Student',
            studentPhone: '01000000012',
            studentCode: '12A',
            remainingSessions: 0, // already 0! (maybe missed previous reset due to error)
            cycleCapacity: 8,
            cycleNumber: 1
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, student._id, { status: AttendanceStatus.PRESENT });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const after = await StudentModel.findById(student._id).lean();
        // The session consumes it to -1, which triggers reset to (8 - 1) = 7?
        // Wait, if it was 0, it consumes from the NEW cycle.
        // So remainingSessions should be 7. 
        expect(after?.remainingSessions).toBe(7);
        expect(after?.cycleNumber).toBe(2);
    });

    it('guest student is decremented from their own cycle', async () => {
        const guestGroup = await seedGroup({
            teacherId: teacher._id,
            name: 'Guest Group',
            schedule: [{ day: 'الأحد', time: '10:00' }] // capacity 4
        });

        const guestStudent = await seedStudent(guestGroup._id, {
            studentName: 'Guest',
            studentPhone: '01000000020',
            studentCode: '20A',
            remainingSessions: 2,
            cycleCapacity: 4,
            cycleNumber: 1
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, guestStudent._id, { status: AttendanceStatus.PRESENT, isGuest: true });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const after = await StudentModel.findById(guestStudent._id).lean();
        expect(after?.remainingSessions).toBe(1);
    });
});
