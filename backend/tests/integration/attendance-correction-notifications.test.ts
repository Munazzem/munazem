import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../src/database/models/attendance-snapshot.model.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { seedTeacher, seedGroup, seedStudent, seedSession } from '../helpers/seed.helper.js';
import { GradeLevel, AttendanceStatus, SessionStatus } from '../../src/common/enums/enum.service.js';

describe('Phase 4 Integration: Attendance Corrections, Revision Tracking & Offline Sync on Completed Sessions', () => {
    let teacher: any;
    let group: any;
    let parent: any;
    const enrolledDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    beforeEach(async () => {
        await ParentNotificationModel.syncIndexes();

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ status: 'ok', id: 'ticket-correction-test' }] }),
        }));

        teacher = await seedTeacher({
            name: 'أستاذ طارق',
            subject: 'كيمياء',
        });

        group = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            name: 'مجموعة الكيمياء 1',
            schedule: [{ day: 'السبت', time: '10:00' }],
        });

        parent = await ParentModel.create({
            phone: '01011223344',
            name: 'ولي أمر طالب التصحيح',
            isActive: true,
        });

        await ParentDeviceModel.create({
            parentId: parent._id,
            deviceId: 'device-correction-uuid',
            fcmToken: 'ExponentPushToken[CorrectionToken12345]',
            refreshTokenHash: 'hash-correction-test',
            platform: 'android',
            isActive: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    async function linkStudent(studentId: mongoose.Types.ObjectId) {
        await ParentStudentModel.create({
            parentId: parent._id,
            studentId,
            studentModelType: 'Student',
            status: 'ACTIVE',
            verifiedVia: 'AUTO_CONFIRMED',
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Revision progression: r0 (complete) -> r1 (ABSENT to PRESENT) -> r2 (back to ABSENT)
    // ─────────────────────────────────────────────────────────────────────────────
    it('progresses revisions r0 -> r1 -> r2 on sequential status corrections', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'يوسف ريفيجن',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
            consecutiveAbsences: 0,
        });
        await linkStudent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            date: new Date(),
            status: SessionStatus.IN_PROGRESS,
        });

        // ── Step 1: Complete session while student is absent (initial notification r0) ──
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());
        await new Promise((resolve) => setTimeout(resolve, 80));

        const r0Notif = await ParentNotificationModel.findOne({
            studentId: student._id,
            eventId: `attendance:${session._id}:${student._id}:r0`,
        }).lean();
        expect(r0Notif).toBeDefined();
        expect(r0Notif?.title).toContain('غائب ⚠️');

        const attDocR0 = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id }).lean();
        expect(attDocR0?.parentNotify?.status).toBe('ABSENT');
        expect(attDocR0?.parentNotify?.rev).toBe(0);

        // ── Step 2: First adjustment: ABSENT -> PRESENT (triggers r1) ──
        const adjust1Result = await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString(),
            'تصحيح حضور يدوي'
        );
        expect(adjust1Result.success).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 80));

        const r1Notif = await ParentNotificationModel.findOne({
            studentId: student._id,
            eventId: `attendance:${session._id}:${student._id}:r1`,
        }).lean();
        expect(r1Notif).toBeDefined();
        expect(r1Notif?.title).toContain('[تصحيح]');
        expect(r1Notif?.title).toContain('حاضر');
        expect(r1Notif?.data?.rev).toBe(1);
        expect(r1Notif?.data?.isCorrection).toBe(true);
        expect(r1Notif?.data?.oldStatus).toBe('ABSENT');
        expect(r1Notif?.data?.status).toBe('PRESENT');

        const attDocR1 = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id }).lean();
        expect(attDocR1?.status).toBe(AttendanceStatus.PRESENT);
        expect(attDocR1?.parentNotify?.status).toBe(AttendanceStatus.PRESENT);
        expect(attDocR1?.parentNotify?.rev).toBe(1);

        // ── Step 3: Second adjustment: PRESENT -> ABSENT (triggers r2) ──
        const adjust2Result = await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.ABSENT,
            teacher._id.toString(),
            teacher._id.toString(),
            'إعادة إلى غائب بالخطأ'
        );
        expect(adjust2Result.success).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 80));

        const r2Notif = await ParentNotificationModel.findOne({
            studentId: student._id,
            eventId: `attendance:${session._id}:${student._id}:r2`,
        }).lean();
        expect(r2Notif).toBeDefined();
        expect(r2Notif?.title).toContain('[تصحيح]');
        expect(r2Notif?.title).toContain('غائب');
        expect(r2Notif?.data?.rev).toBe(2);
        expect(r2Notif?.data?.isCorrection).toBe(true);
        expect(r2Notif?.data?.oldStatus).toBe('PRESENT');
        expect(r2Notif?.data?.status).toBe('ABSENT');

        const attDocR2 = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id }).lean();
        expect(attDocR2?.status).toBe(AttendanceStatus.ABSENT);
        expect(attDocR2?.parentNotify?.status).toBe(AttendanceStatus.ABSENT);
        expect(attDocR2?.parentNotify?.rev).toBe(2);

        // Verify total notifications count for this student is exactly 3 (r0, r1, r2)
        const totalNotifs = await ParentNotificationModel.countDocuments({ studentId: student._id });
        expect(totalNotifs).toBe(3);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Editing homework/notes without status change -> NO notification
    // ─────────────────────────────────────────────────────────────────────────────
    it('does NOT dispatch a correction notification when only notes or homework are updated', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'عمر الملتزم',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            date: new Date(),
            status: SessionStatus.IN_PROGRESS,
        });

        // Student attended on time
        await AttendanceModel.create({
            studentId: student._id,
            sessionId: session._id,
            status: AttendanceStatus.PRESENT,
            homeworkDone: false,
            scannedAt: new Date(),
            type: 'SESSION',
        });

        // Complete session
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());
        await new Promise((resolve) => setTimeout(resolve, 80));

        const countBefore = await ParentNotificationModel.countDocuments({ studentId: student._id });
        expect(countBefore).toBe(1); // r0 notification

        // Update homework to true and add a note, keeping status as PRESENT
        const updateResult = await AttendanceService.adjustCompletedSessionAttendance(
            session._id.toString(),
            student._id.toString(),
            AttendanceStatus.PRESENT,
            teacher._id.toString(),
            teacher._id.toString(),
            'تم فحص الواجب متأخراً وهو ممتاز',
            true
        );
        expect(updateResult.success).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 80));

        // Attendance document has updated homeworkDone and notes
        const updatedDoc = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id }).lean();
        expect(updatedDoc?.homeworkDone).toBe(true);
        expect(updatedDoc?.notes).toBe('تم فحص الواجب متأخراً وهو ممتاز');

        // Revision should NOT advance and no new notification should be generated
        expect(updatedDoc?.parentNotify?.rev).toBe(0);
        const countAfter = await ParentNotificationModel.countDocuments({ studentId: student._id });
        expect(countAfter).toBe(countBefore);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Late Offline Sync for Completed Session preserves rec.scannedAt
    // ─────────────────────────────────────────────────────────────────────────────
    it('preserves actual scannedAt and dispatches correction on offline sync arriving after completion', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'كريم الأوفلاين',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
            barcode: 'BC-OFFLINE-COMPLETED-1',
        });
        await linkStudent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            date: new Date(),
            status: SessionStatus.IN_PROGRESS,
        });

        // Teacher completes the session early while tablet was offline (student marked absent r0)
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());
        await new Promise((resolve) => setTimeout(resolve, 80));

        const r0Count = await ParentNotificationModel.countDocuments({ studentId: student._id });
        expect(r0Count).toBe(1);

        // Device comes online and flushes outbox with actual scan time 35 minutes ago
        const actualScanTime = new Date(Date.now() - 35 * 60 * 1000);
        const syncResult = await AttendanceService.syncBatchAttendance(
            teacher._id.toString(),
            {
                sessionId: session._id.toString(),
                records: [
                    {
                        studentId: student._id.toString(),
                        status: AttendanceStatus.PRESENT,
                        scannedAt: actualScanTime,
                        homeworkDone: true,
                        notes: 'مسجل أوفلاين متزامن بعد الإغلاق',
                    },
                ],
            },
            teacher._id.toString()
        );

        expect(syncResult.success).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 80));

        // 1. Attendance document was updated with actual scan time and rev = 1
        const attDoc = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id }).lean();
        expect(attDoc?.status).toBe(AttendanceStatus.PRESENT);
        expect(attDoc?.homeworkDone).toBe(true);
        expect(new Date(attDoc!.scannedAt).getTime()).toBe(actualScanTime.getTime());
        expect(attDoc?.parentNotify?.rev).toBe(1);

        // 2. Snapshot has the student under presentStudents with the actual scan time
        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id }).lean();
        const presentEntry = snapshot?.presentStudents.find((s: any) => s.studentId.toString() === student._id.toString());
        expect(presentEntry).toBeDefined();
        expect(new Date(presentEntry!.scannedAt!).getTime()).toBe(actualScanTime.getTime());

        // 3. Correction notification r1 was dispatched with actual scannedAt
        const r1Notif = await ParentNotificationModel.findOne({
            studentId: student._id,
            eventId: `attendance:${session._id}:${student._id}:r1`,
        }).lean();
        expect(r1Notif).toBeDefined();
        expect(r1Notif?.title).toContain('[تصحيح]');
        expect(r1Notif?.title).toContain('حاضر');
        expect(r1Notif?.data?.scannedAt).toBe(actualScanTime.toISOString());
    });
});
