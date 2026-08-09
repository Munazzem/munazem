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

    it('advances group cycle and tracks consecutive absences correctly', async () => {
        const studentPresent = await seedStudent(group._id, {
            studentName: 'Present Student',
            consecutiveAbsences: 2 // Has some prior absences
        });
        const studentAbsent = await seedStudent(group._id, {
            studentName: 'Absent Student',
            consecutiveAbsences: 2
        });
        const studentExcused = await seedStudent(group._id, {
            studentName: 'Excused Student',
            excusedSessionsCount: 1 // Pre-excused
        });

        const session = await seedSession(group._id);

        // Mark only studentPresent as PRESENT
        await seedAttendance(session._id, studentPresent._id, { status: AttendanceStatus.PRESENT });
        // Absent is not marked (so attendance service considers them absent)
        // Excused is excused by count

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const afterGroup = await GroupModel.findById(group._id).lean();
        // Group cycle should advance by 1
        expect(afterGroup?.cycle?.currentSessionNumber).toBe(1);
        expect(afterGroup?.cycle?.currentCycleNumber).toBe(1);

        const afterPresent = await StudentModel.findById(studentPresent._id).lean();
        const afterAbsent = await StudentModel.findById(studentAbsent._id).lean();
        const afterExcused = await StudentModel.findById(studentExcused._id).lean();

        // Present student should have absences reset
        expect(afterPresent?.consecutiveAbsences).toBe(0);
        
        // Absent student should increment absences to 3
        expect(afterAbsent?.consecutiveAbsences).toBe(3);

        // Excused student should NOT increment absences, and use their excuse count
        expect(afterExcused?.consecutiveAbsences).toBe(0);
        expect(afterExcused?.excusedSessionsCount).toBe(0);

        // Check attendance records
        const absentRecord = await AttendanceModel.findOne({ studentId: studentAbsent._id, sessionId: session._id }).lean();
        expect(absentRecord?.isConsumed).toBe(true);
        expect(absentRecord?.exemptionDecision?.decision).toBe('PENDING'); // Hit 3 absences

        const excusedRecord = await AttendanceModel.findOne({ studentId: studentExcused._id, sessionId: session._id }).lean();
        expect(excusedRecord?.isConsumed).toBe(false);
    });

    it('auto-resets cycle and increments cycleNumber when capacity is exceeded', async () => {
        // Setup group to be AT capacity (e.g. session 8 of 8)
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.capacity': 8,
                'cycle.currentSessionNumber': 8,
                'cycle.currentCycleNumber': 1
            }
        });

        const student = await seedStudent(group._id, {
            studentName: 'Zero Student'
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, student._id, { status: AttendanceStatus.PRESENT });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const afterGroup = await GroupModel.findById(group._id).lean();
        
        // Cycle should have reset to 1 because 8 + 1 = 9 > 8
        expect(afterGroup?.cycle?.currentSessionNumber).toBe(1); 
        expect(afterGroup?.cycle?.capacity).toBe(8);
        expect(afterGroup?.cycle?.currentCycleNumber).toBe(2);
        expect(afterGroup?.cycle?.startedAt).not.toBeNull();
    });

    it('ensures completed session cycleContext captures the cycle boundaries before rollover', async () => {
        // Setup group to be at session 7 of 8
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.capacity': 8,
                'cycle.currentSessionNumber': 7,
                'cycle.currentCycleNumber': 1
            }
        });

        const student = await seedStudent(group._id, { studentName: 'Boundary Student' });
        const session = await seedSession(group._id);
        await seedAttendance(session._id, student._id, { status: AttendanceStatus.PRESENT });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const afterGroup = await GroupModel.findById(group._id).lean();
        // Since it was at 7, the session consumes it to 8.
        expect(afterGroup?.cycle?.currentSessionNumber).toBe(8); 
        expect(afterGroup?.cycle?.currentCycleNumber).toBe(1);

        const completedSession = await SessionModel.findById(session._id).lean();
        // Session context should be exactly what it reached
        expect(completedSession?.cycleContext?.cycleNumber).toBe(1);
        expect(completedSession?.cycleContext?.sessionNumber).toBe(8);
    });

    it('preserves student consecutive absences tracking independently of cycles', async () => {
        // Even if cycle resets, student consecutive absences continue to track
        await GroupModel.findByIdAndUpdate(group._id, {
            $set: {
                'cycle.capacity': 8,
                'cycle.currentSessionNumber': 8,
                'cycle.currentCycleNumber': 1
            }
        });

        const student = await seedStudent(group._id, {
            studentName: 'Negative Student',
            consecutiveAbsences: 1
        });

        const session = await seedSession(group._id); // This will be the 9th session (rolls over to C2 S1)

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        const afterGroup = await GroupModel.findById(group._id).lean();
        expect(afterGroup?.cycle?.currentCycleNumber).toBe(2);
        expect(afterGroup?.cycle?.currentSessionNumber).toBe(1);

        const afterStudent = await StudentModel.findById(student._id).lean();
        // The student was absent (no present mark), so it becomes 2
        expect(afterStudent?.consecutiveAbsences).toBe(2);
    });

    it('guest student does not advance their own group cycle but records attendance', async () => {
        const guestGroup = await seedGroup({
            teacherId: teacher._id,
            name: 'Guest Group',
            schedule: [{ day: 'الأحد', time: '10:00' }]
        });
        await GroupModel.findByIdAndUpdate(guestGroup._id, {
            $set: { 'cycle.currentSessionNumber': 2, 'cycle.currentCycleNumber': 1 }
        });

        const guestStudent = await seedStudent(guestGroup._id, {
            studentName: 'Guest'
        });

        const session = await seedSession(group._id);
        await seedAttendance(session._id, guestStudent._id, { status: AttendanceStatus.PRESENT, isGuest: true });

        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());

        // Guest's group cycle should NOT be affected
        const afterGuestGroup = await GroupModel.findById(guestGroup._id).lean();
        expect(afterGuestGroup?.cycle?.currentSessionNumber).toBe(2);
        expect(afterGuestGroup?.cycle?.currentCycleNumber).toBe(1);

        // Host group cycle SHOULD advance
        const afterHostGroup = await GroupModel.findById(group._id).lean();
        expect(afterHostGroup?.cycle?.currentSessionNumber).toBe(1);

        // Attendance record should be created
        const guestRecord = await AttendanceModel.findOne({ studentId: guestStudent._id, sessionId: session._id }).lean();
        expect(guestRecord).toBeDefined();
        expect(guestRecord?.isGuest).toBe(true);
    });
});
