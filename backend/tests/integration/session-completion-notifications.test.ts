import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { ParentPushService } from '../../src/modules/parent/parent-push.service.js';
import { AttendanceModel } from '../../src/database/models/attendance.model.js';
import { AttendanceSnapshotModel } from '../../src/database/models/attendance-snapshot.model.js';
import { SessionModel } from '../../src/database/models/session.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { GroupModel } from '../../src/database/models/group.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import * as whatsappQueueModule from '../../src/infrastructure/queues/whatsapp.queue.js';
import { seedTeacher, seedGroup, seedStudent, seedSession } from '../helpers/seed.helper.js';
import { GradeLevel, AttendanceStatus, SessionStatus } from '../../src/common/enums/enum.service.js';

describe('Phase 3 Integration: Unified Session Completion Notifications & 48h Stale Filter', () => {
    let teacher: any;
    let group: any;
    let parent: any;
    let whatsappSpy: any;
    const enrolledDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago

    beforeEach(async () => {
        // Ensure index for ParentNotificationModel is built in MongoMemoryServer
        await ParentNotificationModel.syncIndexes();

        // Intercept global fetch so Expo Push requests do not hit the real internet
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [{ status: 'ok', id: 'ticket-test-123' }] }),
        }));

        whatsappSpy = vi.spyOn(whatsappQueueModule, 'enqueueWhatsApp');

        teacher = await seedTeacher({
            name: 'أستاذ محمود',
            subject: 'فيزياء',
        });

        group = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            name: 'مجموعة الفيزياء أ',
            schedule: [{ day: 'السبت', time: '10:00' }, { day: 'الثلاثاء', time: '10:00' }],
        });

        // Parent with device and token
        parent = await ParentModel.create({
            phone: '01098765432',
            name: 'ولي أمر معتمد',
            isActive: true,
        });

        await ParentDeviceModel.create({
            parentId: parent._id,
            deviceId: 'device-phase3-uuid',
            fcmToken: 'ExponentPushToken[Phase3ValidPushToken12345]',
            refreshTokenHash: 'hash-phase3-test',
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
    // 1. Comprehensive Student Classification upon completeSession
    // ─────────────────────────────────────────────────────────────────────────────
    it('accurately classifies all 7 attendance states and dispatches unified batch notifications', async () => {
        const otherGroup = await seedGroup({
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            name: 'مجموعة الفيزياء ب',
            schedule: [{ day: 'الأحد', time: '14:00' }],
        });

        const sessionDate = new Date();
        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            date: sessionDate,
            startTime: '10:00',
            status: SessionStatus.IN_PROGRESS,
        });

        // (1) PRESENT student
        const studentPresent = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'أحمد الحاضر',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentPresent._id);
        const presentScanTime = new Date(Date.now() - 30 * 60 * 1000);
        await AttendanceModel.create({
            studentId: studentPresent._id,
            sessionId: session._id,
            status: AttendanceStatus.PRESENT,
            scannedAt: presentScanTime,
            homeworkDone: true,
            isGuest: false,
            type: 'SESSION',
        });

        // (2) LATE student
        const studentLate = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'باسم المتأخر',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentLate._id);
        const lateScanTime = new Date(Date.now() - 15 * 60 * 1000);
        await AttendanceModel.create({
            studentId: studentLate._id,
            sessionId: session._id,
            status: AttendanceStatus.LATE,
            scannedAt: lateScanTime,
            homeworkDone: false,
            isGuest: false,
            type: 'SESSION',
        });

        // (3) ABSENT student (no attendance record beforehand)
        const studentAbsent = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'جمال الغائب',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentAbsent._id);

        // (4) Regular GUEST student (from otherGroup, no past compensation)
        const studentGuest = await seedStudent(otherGroup._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'داود الزائر',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentGuest._id);
        const guestScanTime = new Date(Date.now() - 25 * 60 * 1000);
        await AttendanceModel.create({
            studentId: studentGuest._id,
            sessionId: session._id,
            status: AttendanceStatus.PRESENT,
            scannedAt: guestScanTime,
            isGuest: true,
            notes: 'طالب زائر من مجموعة أخرى',
            type: 'SESSION',
        });

        // (5) GUEST_COMPENSATED student (guest who compensated a past session)
        const studentGuestComp = await seedStudent(otherGroup._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'هاني الزائر المعوض',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentGuestComp._id);
        const pastSessionId = new mongoose.Types.ObjectId();
        await AttendanceModel.create({
            studentId: studentGuestComp._id,
            sessionId: session._id,
            status: AttendanceStatus.PRESENT,
            scannedAt: new Date(Date.now() - 20 * 60 * 1000),
            isGuest: true,
            relatedSessionId: pastSessionId,
            relatedGroupName: 'مجموعة الفيزياء ب',
            notes: 'طالب زائر — تعويض عن غياب في مجموعة (مجموعة الفيزياء ب)',
            type: 'SESSION',
        });

        // (6) EXCUSED student (has excusedSessionsCount > 0)
        const studentExcused = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'فارس المستأذن',
            excusedSessionsCount: 2,
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentExcused._id);

        // (7) COMPENSATED_ADVANCE student (attended otherGroup earlier within window)
        const studentAdvanceComp = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'سامي المعوض مسبقا',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(studentAdvanceComp._id);
        const otherGroupSession = await seedSession(otherGroup._id, {
            teacherId: teacher._id,
            date: new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000),
            status: SessionStatus.COMPLETED,
        });
        // Student 7 attended otherGroup session as guest earlier
        await AttendanceModel.create({
            studentId: studentAdvanceComp._id,
            sessionId: otherGroupSession._id,
            status: AttendanceStatus.PRESENT,
            isGuest: true,
            scannedAt: otherGroupSession.date,
            type: 'SESSION',
        });

        // ── Act: Complete session ──
        const completeResult = await AttendanceService.completeSession(
            session._id.toString(),
            teacher._id.toString()
        );
        expect(completeResult.session.status).toBe(SessionStatus.COMPLETED);

        // Allow background setImmediate batch notification to finish
        await new Promise((resolve) => setTimeout(resolve, 80));

        // ── Assert 1: Verify ParentNotificationModel documents ──
        const notifs = await ParentNotificationModel.find({
            parentId: parent._id,
            teacherId: teacher._id,
        }).lean();

        // 7 distinct notifications must be created
        expect(notifs.length).toBe(7);

        // Map notifications by studentId
        const notifMap = new Map(notifs.map((n) => [n.studentId.toString(), n]));

        // Check PRESENT
        const nPresent = notifMap.get(studentPresent._id.toString())!;
        expect(nPresent).toBeDefined();
        expect(nPresent.title).toContain('حاضر ✓');
        expect(nPresent.type).toBe('ATTENDANCE_PRESENT');

        // Check LATE
        const nLate = notifMap.get(studentLate._id.toString())!;
        expect(nLate).toBeDefined();
        expect(nLate.title).toContain('حاضر (متأخر) ⏰');
        expect(nLate.type).toBe('ATTENDANCE_PRESENT');

        // Check ABSENT
        const nAbsent = notifMap.get(studentAbsent._id.toString())!;
        expect(nAbsent).toBeDefined();
        expect(nAbsent.title).toContain('غائب ⚠️');
        expect(nAbsent.type).toBe('ATTENDANCE_ABSENT');

        // Check GUEST
        const nGuest = notifMap.get(studentGuest._id.toString())!;
        expect(nGuest).toBeDefined();
        expect(nGuest.title).toContain('حاضر كزائر 🔄');

        // Check GUEST_COMPENSATED
        const nGuestComp = notifMap.get(studentGuestComp._id.toString())!;
        expect(nGuestComp).toBeDefined();
        expect(nGuestComp.title).toContain('حاضر كزائر (تعويض غياب) 🔄');

        // Check EXCUSED
        const nExcused = notifMap.get(studentExcused._id.toString())!;
        expect(nExcused).toBeDefined();
        expect(nExcused.title).toContain('مُستأذن 📝');

        // Check COMPENSATED_ADVANCE
        const nAdvanceComp = notifMap.get(studentAdvanceComp._id.toString())!;
        expect(nAdvanceComp).toBeDefined();
        expect(nAdvanceComp.title).toContain('معوّض مسبقاً 🔄');

        // ── Assert 2: parentNotify stamp updated on AttendanceModel ──
        const finalAttendanceDocs = await AttendanceModel.find({ sessionId: session._id }).lean();
        for (const doc of finalAttendanceDocs) {
            expect(doc.parentNotify).toBeDefined();
            expect(doc.parentNotify?.rev).toBe(0);
            expect(doc.parentNotify?.sentAt).toBeInstanceOf(Date);
        }

        // ── Assert 3: WhatsApp queue was called for absent student ──
        expect(whatsappSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 'session_absent',
                studentId: studentAbsent._id.toString(),
                teacherId: teacher._id.toString(),
                parentPhone: parent.phone,
            })
        );
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. Idempotency & Double Invocation
    // ─────────────────────────────────────────────────────────────────────────────
    it('prevents duplicate notifications upon double invocation of completeSession or batch send', async () => {
        const student = await seedStudent(group._id, {
            teacherId: teacher._id,
            gradeLevel: GradeLevel.SEC_1,
            studentName: 'طالب فحص التكرار',
            parentPhone: parent.phone,
            createdAt: enrolledDate,
            groupAssignedAt: enrolledDate,
        });
        await linkStudent(student._id);

        const session = await seedSession(group._id, {
            teacherId: teacher._id,
            status: SessionStatus.IN_PROGRESS,
            date: new Date(),
        });

        // First completion
        await AttendanceService.completeSession(session._id.toString(), teacher._id.toString());
        await new Promise((resolve) => setTimeout(resolve, 80));

        const countAfterFirst = await ParentNotificationModel.countDocuments();
        expect(countAfterFirst).toBe(1);

        // Second completion call MUST throw BadRequestException
        await expect(
            AttendanceService.completeSession(session._id.toString(), teacher._id.toString())
        ).rejects.toThrow('الحصة مكتملة بالفعل');

        // Direct batch resend test (simulating network retry of the batch function)
        const batchResendResult = await ParentPushService._sendSessionAttendanceBatch({
            sessionId: session._id.toString(),
            teacherId: teacher._id.toString(),
            sessionDate: session.date,
            items: [
                {
                    studentId: student._id.toString(),
                    studentName: student.studentName,
                    status: 'ABSENT',
                    kind: 'ABSENT',
                },
            ],
        });

        // Duplicate insert is ignored via unique compound index { parentId, eventId }
        expect(batchResendResult.insertedCount).toBe(0);
        expect(batchResendResult.pushCount).toBe(0);

        const countAfterRetry = await ParentNotificationModel.countDocuments();
        expect(countAfterRetry).toBe(countAfterFirst);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. Stale Session 48-Hour Filter in autoCompleteStaleGroupSessions (Q3)
    // ─────────────────────────────────────────────────────────────────────────────
    describe('autoCompleteStaleGroupSessions 48-hour cutoff', () => {
        it('dispatches notifications for stale session within last 48 hours', async () => {
            const student = await seedStudent(group._id, {
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_1,
                studentName: 'طالب حصة متروكة حديثة',
                parentPhone: parent.phone,
                createdAt: enrolledDate,
                groupAssignedAt: enrolledDate,
            });
            await linkStudent(student._id);

            // Stale session 12 hours ago (within 48 hours)
            const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000);
            const staleSession = await seedSession(group._id, {
                teacherId: teacher._id,
                date: recentDate,
                status: SessionStatus.IN_PROGRESS,
            });

            // Trigger auto-complete
            await AttendanceService.autoCompleteStaleGroupSessions(group._id, teacher._id);
            await new Promise((resolve) => setTimeout(resolve, 80));

            // Verify session is completed
            const updated = await SessionModel.findById(staleSession._id).lean();
            expect(updated?.status).toBe(SessionStatus.COMPLETED);

            // Verify notification WAS dispatched
            const notif = await ParentNotificationModel.findOne({ studentId: student._id }).lean();
            expect(notif).toBeDefined();
            expect(notif?.title).toContain('غائب ⚠️');
        });

        it('silently completes stale session older than 48 hours without notifications', async () => {
            const student = await seedStudent(group._id, {
                teacherId: teacher._id,
                gradeLevel: GradeLevel.SEC_1,
                studentName: 'طالب حصة قديمة متروكة',
                parentPhone: parent.phone,
                createdAt: enrolledDate,
                groupAssignedAt: enrolledDate,
            });
            await linkStudent(student._id);

            // Stale session 72 hours ago (older than 48 hours)
            const oldDate = new Date(Date.now() - 72 * 60 * 60 * 1000);
            const oldSession = await seedSession(group._id, {
                teacherId: teacher._id,
                date: oldDate,
                status: SessionStatus.IN_PROGRESS,
            });

            // Trigger auto-complete
            await AttendanceService.autoCompleteStaleGroupSessions(group._id, teacher._id);
            await new Promise((resolve) => setTimeout(resolve, 80));

            // Verify session is completed
            const updated = await SessionModel.findById(oldSession._id).lean();
            expect(updated?.status).toBe(SessionStatus.COMPLETED);

            // Verify notification was NOT dispatched (silent completion)
            const notif = await ParentNotificationModel.findOne({ studentId: student._id }).lean();
            expect(notif).toBeNull();
        });
    });
});
