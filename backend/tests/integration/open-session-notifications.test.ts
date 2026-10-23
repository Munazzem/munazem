import { describe, it, expect, beforeEach } from 'vitest';
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

describe('Phase 2 Integration: Open Session Notification Suppression & scannedAt Update', () => {
    let teacher: any;
    let group: any;
    let parent: any;

    beforeEach(async () => {
        teacher = await seedTeacher({
            name: 'أستاذ أحمد',
            subject: 'رياضيات',
        });

        group = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            schedule: [{ day: 'الأحد', time: '14:00' }],
        });

        // Seed a registered parent with an active device and valid push token
        parent = await ParentModel.create({
            phone: '01012345678',
            name: 'ولي أمر تجريبي',
            isActive: true,
        });

        await ParentDeviceModel.create({
            parentId: parent._id,
            deviceId: 'test-device-uuid-1',
            fcmToken: 'ExponentPushToken[ValidTokenForIntegrationTest123]',
            refreshTokenHash: 'test-refresh-token-hash-123',
            platform: 'android',
            isActive: true,
        });
    });

    async function linkStudentToParent(studentId: mongoose.Types.ObjectId) {
        await ParentStudentModel.create({
            parentId: parent._id,
            studentId,
            studentModelType: 'Student',
            status: 'ACTIVE',
            verifiedVia: 'AUTO_CONFIRMED',
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. Single scan (recordAttendance) during open session
    // ─────────────────────────────────────────────────────────────────────────────
    it('recordAttendance during open session does NOT dispatch parent push notification', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            barcode: 'BC-OPEN-1',
            parentPhone: parent.phone,
        });
        await linkStudentToParent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            status: SessionStatus.SCHEDULED,
            date: new Date(),
        });

        // Record attendance for the student
        // Signature: (scannedBy, data, teacherId)
        const record = await AttendanceService.recordAttendance(
            teacher._id.toString(),
            {
                sessionId: session._id.toString(),
                studentId: 'BC-OPEN-1',
                status: AttendanceStatus.PRESENT,
                homeworkDone: true,
            },
            teacher._id.toString()
        );

        expect(record).toBeDefined();
        expect(record.status).toBe(AttendanceStatus.PRESENT);
        expect(record.scannedAt).toBeInstanceOf(Date);

        // Verification: Database count of ParentNotificationModel MUST strictly remain 0
        const notifCount = await ParentNotificationModel.countDocuments();
        expect(notifCount).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Batch recording (batchRecordAttendance) during open session
    // ─────────────────────────────────────────────────────────────────────────────
    it('batchRecordAttendance during open session creates records but sends NO parent notifications', async () => {
        const student1 = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            barcode: 'BC-BATCH-1',
            parentPhone: parent.phone,
        });
        const student2 = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            barcode: 'BC-BATCH-2',
            parentPhone: parent.phone,
        });
        await linkStudentToParent(student1._id);
        await linkStudentToParent(student2._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            status: SessionStatus.SCHEDULED,
            date: new Date(),
        });

        // Signature: (scannedBy, data, teacherId)
        const batchResult = await AttendanceService.batchRecordAttendance(
            teacher._id.toString(),
            {
                sessionId: session._id.toString(),
                records: [
                    { studentId: student1._id.toString(), status: AttendanceStatus.PRESENT, homeworkDone: true },
                    { studentId: student2._id.toString(), status: AttendanceStatus.ABSENT, homeworkDone: false },
                ],
            },
            teacher._id.toString()
        );

        expect(batchResult.inserted).toBe(2);

        // Verification: DB attendance records exist
        const dbRecords = await AttendanceModel.find({ sessionId: session._id });
        expect(dbRecords).toHaveLength(2);

        // Verification: Zero parent notifications generated
        const notifCount = await ParentNotificationModel.countDocuments();
        expect(notifCount).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Offline batch sync (syncBatchAttendance) during open session
    // ─────────────────────────────────────────────────────────────────────────────
    it('syncBatchAttendance during open session creates/upserts records with NO parent notifications', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            barcode: 'BC-SYNC-1',
            parentPhone: parent.phone,
        });
        await linkStudentToParent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            status: SessionStatus.SCHEDULED,
            date: new Date(),
        });

        // Signature: (scannedBy, data, teacherId)
        const syncResult = await AttendanceService.syncBatchAttendance(
            teacher._id.toString(),
            {
                sessionId: session._id.toString(),
                records: [
                    {
                        studentId: student._id.toString(),
                        status: AttendanceStatus.PRESENT,
                        scannedAt: new Date(),
                        homeworkDone: true,
                    },
                ],
            },
            teacher._id.toString()
        );

        expect(syncResult.success).toBe(true);
        expect(syncResult.upsertedCount).toBe(1);

        // Verification: Zero notifications in database
        const notifCount = await ParentNotificationModel.countDocuments();
        expect(notifCount).toBe(0);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. updateAttendance status transitions and scannedAt updates (Q2 requirement)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('updateAttendance behavior in open session', () => {
        it('transitions from ABSENT to PRESENT updates scannedAt to now and sends NO notifications', async () => {
            const student = await seedStudent(group._id, {
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_1,
                parentPhone: parent.phone,
            });
            await linkStudentToParent(student._id);

            const session = await seedSession(group._id, {
                teacherId: teacher._id,
                status: SessionStatus.SCHEDULED,
                date: new Date(),
            });

            // Initially marked ABSENT 45 minutes ago
            const initialPastTime = new Date(Date.now() - 45 * 60 * 1000);
            const initialRecord = await AttendanceModel.create({
                studentId: student._id,
                sessionId: session._id,
                status: AttendanceStatus.ABSENT,
                scannedAt: initialPastTime,
                scannedBy: teacher._id,
                type: 'SESSION',
            });

            const beforeUpdate = Date.now();

            // Student arrives -> teacher updates status to PRESENT
            // Signature: updateAttendance(attendanceId, updatedBy, status, teacherId, notes, homeworkDone)
            const updatedRecord = await AttendanceService.updateAttendance(
                initialRecord._id.toString(),
                teacher._id.toString(),
                AttendanceStatus.PRESENT,
                teacher._id.toString()
            );

            expect(updatedRecord).toBeDefined();
            expect(updatedRecord?.status).toBe(AttendanceStatus.PRESENT);

            // Q2 Verification: scannedAt was updated to the actual arrival time (now)
            expect(updatedRecord?.scannedAt).toBeDefined();
            const updatedTime = new Date(updatedRecord!.scannedAt!).getTime();
            expect(updatedTime).toBeGreaterThanOrEqual(beforeUpdate - 1000);
            expect(updatedTime).toBeGreaterThan(initialPastTime.getTime());

            // Verification: Zero notifications sent
            const notifCount = await ParentNotificationModel.countDocuments();
            expect(notifCount).toBe(0);
        });

        it('transitions from EXCUSED to LATE updates scannedAt to now and sends NO notifications', async () => {
            const student = await seedStudent(group._id, {
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_1,
                parentPhone: parent.phone,
            });
            await linkStudentToParent(student._id);

            const session = await seedSession(group._id, {
                teacherId: teacher._id,
                status: SessionStatus.SCHEDULED,
                date: new Date(),
            });

            // Initially EXCUSED 30 minutes ago
            const initialPastTime = new Date(Date.now() - 30 * 60 * 1000);
            const initialRecord = await AttendanceModel.create({
                studentId: student._id,
                sessionId: session._id,
                status: AttendanceStatus.EXCUSED,
                scannedAt: initialPastTime,
                scannedBy: teacher._id,
                type: 'SESSION',
            });

            const beforeUpdate = Date.now();

            // Status changed to LATE
            const updatedRecord = await AttendanceService.updateAttendance(
                initialRecord._id.toString(),
                teacher._id.toString(),
                AttendanceStatus.LATE,
                teacher._id.toString()
            );

            expect(updatedRecord?.status).toBe(AttendanceStatus.LATE);

            // Q2 Verification: scannedAt was updated to now
            const updatedTime = new Date(updatedRecord!.scannedAt!).getTime();
            expect(updatedTime).toBeGreaterThanOrEqual(beforeUpdate - 1000);
            expect(updatedTime).toBeGreaterThan(initialPastTime.getTime());

            // Verification: Zero notifications sent
            const notifCount = await ParentNotificationModel.countDocuments();
            expect(notifCount).toBe(0);
        });

        it('transitions from PRESENT to LATE retains the original scannedAt time', async () => {
            const student = await seedStudent(group._id, {
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_1,
                parentPhone: parent.phone,
            });

            const session = await seedSession(group._id, {
                teacherId: teacher._id,
                status: SessionStatus.SCHEDULED,
                date: new Date(),
            });

            // Student was scanned PRESENT 10 minutes ago
            const originalScanTime = new Date(Date.now() - 10 * 60 * 1000);
            const initialRecord = await AttendanceModel.create({
                studentId: student._id,
                sessionId: session._id,
                status: AttendanceStatus.PRESENT,
                scannedAt: originalScanTime,
                scannedBy: teacher._id,
                type: 'SESSION',
            });

            // Teacher updates note or changes status to LATE (not from ABSENT or EXCUSED)
            const updatedRecord = await AttendanceService.updateAttendance(
                initialRecord._id.toString(),
                teacher._id.toString(),
                AttendanceStatus.LATE,
                teacher._id.toString()
            );

            expect(updatedRecord?.status).toBe(AttendanceStatus.LATE);
            // scannedAt must NOT be overwritten when transitioning from PRESENT
            expect(new Date(updatedRecord!.scannedAt!).getTime()).toBe(originalScanTime.getTime());

            const notifCount = await ParentNotificationModel.countDocuments();
            expect(notifCount).toBe(0);
        });
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. Retroactive Guest Compensation during open session
    // ─────────────────────────────────────────────────────────────────────────────
    it('retroactive guest compensation updates records and snapshots without sending immediate notifications', async () => {
        // Group A (Home group of student)
        const homeGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            name: 'مجموعة الأحد الأصلية',
        });

        // Group B (Host group)
        const hostGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            name: 'مجموعة الثلاثاء المستضيفة',
        });

        const student = await seedStudent(homeGroup._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'طالب زائر معوّض',
            consecutiveAbsences: 1,
            barcode: 'BC-GUEST-COMP-1',
            parentPhone: parent.phone,
        });
        await linkStudentToParent(student._id);

        // Past session in Home Group where student was ABSENT
        const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
        const pastSession = await seedSession(homeGroup._id, {
            teacherId: teacher._id,
            date: pastDate,
            status: SessionStatus.COMPLETED,
        });

        const pastAbsentRecord = await AttendanceModel.create({
            studentId: student._id,
            sessionId: pastSession._id,
            status: AttendanceStatus.ABSENT,
            scannedAt: pastDate,
            scannedBy: teacher._id,
            type: 'SESSION',
        });

        // Create snapshot for past session
        await AttendanceSnapshotModel.create({
            sessionId: pastSession._id,
            teacherId: teacher._id,
            groupId: homeGroup._id,
            date: pastDate,
            absentStudents: [{
                studentId: student._id,
                studentName: student.studentName,
                scannedAt: pastDate,
                status: AttendanceStatus.ABSENT,
            }],
            presentStudents: [],
            compensatedStudents: [],
            absentCount: 1,
            presentCount: 0,
            compensatedCount: 0,
            totalCount: 1,
        });

        // Today's open session in Host Group
        const todaySession = await seedSession(hostGroup._id, {
            teacherId: teacher._id,
            date: new Date(),
            status: SessionStatus.SCHEDULED,
        });

        // Student attends host group as guest
        const guestRecord = await AttendanceService.recordAttendance(
            teacher._id.toString(),
            {
                sessionId: todaySession._id.toString(),
                studentId: 'BC-GUEST-COMP-1',
                status: AttendanceStatus.PRESENT,
                homeworkDone: true,
            },
            teacher._id.toString()
        );

        expect(guestRecord.isGuest).toBe(true);

        // Verification 1: Past absent record is converted to EXCUSED
        const updatedPastRecord = await AttendanceModel.findById(pastAbsentRecord._id);
        expect(updatedPastRecord?.status).toBe(AttendanceStatus.EXCUSED);
        expect(updatedPastRecord?.notes).toContain('معوّض');

        // Verification 2: Past snapshot is updated (absent count decremented, compensated added)
        const updatedSnapshot = await AttendanceSnapshotModel.findOne({ sessionId: pastSession._id });
        expect(updatedSnapshot?.absentCount).toBe(0);
        expect(updatedSnapshot?.compensatedCount).toBe(1);

        // Verification 3: Consecutive absences decremented
        const updatedStudent = await StudentModel.findById(student._id);
        expect(updatedStudent?.consecutiveAbsences).toBe(0);

        // Verification 4: NO notifications created during open session (deferred to completeSession)
        const notifCount = await ParentNotificationModel.countDocuments();
        expect(notifCount).toBe(0);
    });
});
