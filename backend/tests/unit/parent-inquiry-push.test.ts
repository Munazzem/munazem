import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ParentPushService } from '../../src/modules/parent/parent-push.service.js';
import { ParentInquiryModel } from '../../src/database/models/parent-inquiry.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { GradeLevel, UserRole } from '../../src/common/enums/enum.service.js';
import { ParentNotificationType } from '../../src/types/parent.types.js';

describe('Phase 3 Unit: Parent Inquiry Reply Push & In-App Notification', () => {
  let teacher: any;
  let parent: any;
  let student: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    await ParentNotificationModel.createIndexes();
    await ParentInquiryModel.createIndexes();

    teacher = await UserModel.create({
      name: 'أ/ خالد حسن',
      subject: 'رياضيات',
      phone: '01010101010',
      password: 'hashed-password',
      role: UserRole.teacher,
      isActive: true,
    });

    parent = await ParentModel.create({
      phone: '01020202020',
      name: 'ولي أمر الطالب',
      isActive: true,
    });

    await ParentDeviceModel.create({
      parentId: parent._id,
      deviceId: 'device-inquiry-1',
      fcmToken: 'ExponentPushToken[inquiry-unit-token-1]',
      refreshTokenHash: 'hash-1',
      platform: 'android',
      isActive: true,
    });

    student = await StudentModel.create({
      studentName: 'عمر خالد',
      parentName: 'ولي أمر الطالب',
      gradeLevel: GradeLevel.SEC_1,
      studentCode: '50A',
      teacherId: teacher._id,
      groupId: new mongoose.Types.ObjectId(),
      isActive: true,
      remainingSessions: 6,
    });
  });

  it('1. should send push and save in-app notification when link is ACTIVE, with deterministic eventId, deepLink, and NO kind key in data (Decision O1)', async () => {
    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: student._id,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    const longReply = 'ب'.repeat(240);
    const inquiry = await ParentInquiryModel.create({
      parentId: parent._id,
      studentId: student._id,
      teacherId: teacher._id,
      studentName: student.studentName,
      groupName: 'مجموعة الأحد',
      category: 'ABSENCE_EXCUSE',
      body: 'أعتذر عن غياب عمر اليوم لظرف صحي',
      status: 'REPLIED',
      isOpen: false,
      assignedTo: 'ASSISTANT',
      clientRequestId: 'inq-push-1',
      reply: {
        body: longReply,
        repliedBy: teacher._id,
        repliedByRole: 'teacher',
        repliedByName: teacher.name,
        repliedAt: new Date(),
        clientRequestId: 'rep-push-1',
      },
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'ok', id: 'ticket-inquiry-1' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ParentPushService._sendInquiryReply(inquiry._id.toString());
    expect(res).toEqual({ inserted: true, pushSent: true });

    const expectedEventId = `inquiry_reply:${inquiry._id.toString()}`;
    const savedNotif = await ParentNotificationModel.findOne({
      parentId: parent._id,
      eventId: expectedEventId,
    }).lean();

    expect(savedNotif).toBeDefined();
    expect(savedNotif?.type).toBe(ParentNotificationType.INQUIRY_REPLY);
    expect(savedNotif?.deepLink).toBe('monazem://notifications');
    expect(savedNotif?.body).toBe(longReply);
    expect(savedNotif?.title).toContain(student.studentName);

    // Crucial backward-compatibility assertion (O1): data MUST NOT have `kind`
    expect(savedNotif?.data).toBeDefined();
    expect('kind' in (savedNotif?.data || {})).toBe(false);
    expect(savedNotif?.data?.kind).toBeUndefined();
    expect(savedNotif?.data?.inquiryId).toBe(inquiry._id.toString());
    expect(savedNotif?.data?.category).toBe('ABSENCE_EXCUSE');
    expect(savedNotif?.data?.repliedByRole).toBe('teacher');

    // Verify Expo push payload truncation to 180 chars and no `kind` in data
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sentMessages = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].to).toBe('ExponentPushToken[inquiry-unit-token-1]');
    expect(sentMessages[0].body.length).toBeLessThanOrEqual(180);
    expect(sentMessages[0].body).toBe(longReply.slice(0, 177) + '...');
    expect('kind' in (sentMessages[0].data || {})).toBe(false);

    // Calling _sendInquiryReply a second time must be idempotent (no duplicate push)
    const secondRes = await ParentPushService._sendInquiryReply(inquiry._id.toString());
    expect(secondRes).toEqual({ inserted: false, pushSent: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('2. should NOT send notification or push if ParentStudent link is REVOKED or missing', async () => {
    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: student._id,
      status: 'REVOKED',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    const inquiry = await ParentInquiryModel.create({
      parentId: parent._id,
      studentId: student._id,
      teacherId: teacher._id,
      studentName: student.studentName,
      category: 'GENERAL',
      body: 'استفسار عام',
      status: 'REPLIED',
      isOpen: false,
      assignedTo: 'ASSISTANT',
      clientRequestId: 'inq-revoked-1',
      reply: {
        body: 'رد بعد فك الارتباط',
        repliedBy: teacher._id,
        repliedByRole: 'teacher',
        repliedByName: teacher.name,
        repliedAt: new Date(),
        clientRequestId: 'rep-revoked-1',
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await ParentPushService._sendInquiryReply(inquiry._id.toString());
    expect(res).toEqual({ inserted: false, pushSent: false });
    expect(fetchMock).not.toHaveBeenCalled();

    const count = await ParentNotificationModel.countDocuments({
      parentId: parent._id,
    });
    expect(count).toBe(0);
  });

  it('3. should handle Expo Push network/HTTP errors gracefully without throwing unhandled rejection', async () => {
    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: student._id,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    const inquiry = await ParentInquiryModel.create({
      parentId: parent._id,
      studentId: student._id,
      teacherId: teacher._id,
      studentName: student.studentName,
      category: 'FINANCIAL',
      body: 'استفسار مالي',
      status: 'REPLIED',
      isOpen: false,
      assignedTo: 'ASSISTANT',
      clientRequestId: 'inq-expo-fail-1',
      reply: {
        body: 'تم تسوية الحساب',
        repliedBy: teacher._id,
        repliedByRole: 'teacher',
        repliedByName: teacher.name,
        repliedAt: new Date(),
        clientRequestId: 'rep-expo-fail-1',
      },
    });

    // Simulate network failure on fetch
    const fetchMock = vi.fn().mockRejectedValue(new Error('Expo server unreachable'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      ParentPushService._sendInquiryReply(inquiry._id.toString())
    ).resolves.toBeDefined();

    // In-app notification must still be saved in DB despite Expo network error
    const saved = await ParentNotificationModel.findOne({
      eventId: `inquiry_reply:${inquiry._id.toString()}`,
    });
    expect(saved).toBeDefined();
  });
});
