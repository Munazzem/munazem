import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ParentPushService } from '../../src/modules/parent/parent-push.service.js';
import { TeacherMessageModel } from '../../src/database/models/teacher-message.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { GradeLevel, UserRole } from '../../src/common/enums/enum.service.js';

describe('Phase 2 Unit: Teacher Message Push & Content Builder', () => {
  let teacher: any;

  beforeEach(async () => {
    vi.restoreAllMocks();

    teacher = await UserModel.create({
      name: 'أ/ محمد إبراهيم',
      subject: 'فيزياء',
      phone: '01011111111',
      password: 'hashed-password',
      role: UserRole.teacher,
      isActive: true,
    });
  });

  it('should return safely if messageId does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await ParentPushService._sendTeacherMessage(fakeId);
    expect(res).toEqual({ insertedCount: 0, pushCount: 0 });
  });

  it('should skip processing if message is not in SENDING status', async () => {
    const msg = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GRADE',
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة تم إرسالها مسبقاً',
      clientRequestId: 'req-already-sent',
      status: 'SENT',
    });

    const res = await ParentPushService._sendTeacherMessage(msg._id.toString());
    expect(res).toEqual({ insertedCount: 0, pushCount: 0 });
  });

  it('should truncate push notification body to 180 chars while keeping full body in DB doc', async () => {
    const parent = await ParentModel.create({
      phone: '01022222222',
      name: 'ولي أمر طالب',
      isActive: true,
    });

    await ParentDeviceModel.create({
      parentId: parent._id,
      deviceId: 'device-1',
      fcmToken: 'ExponentPushToken[unit-test-token-1]',
      refreshTokenHash: 'hash-1',
      platform: 'android',
      isActive: true,
    });

    const student = await StudentModel.create({
      studentName: 'محمود محمد',
      parentName: 'ولي أمر طالب',
      gradeLevel: GradeLevel.SEC_1,
      studentCode: '10A',
      teacherId: teacher._id,
      groupId: new mongoose.Types.ObjectId(),
      isActive: true,
      remainingSessions: 4,
    });

    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: student._id,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    const longBody = 'أ'.repeat(250);
    const msg = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GRADE',
      gradeLevel: GradeLevel.SEC_1,
      title: 'تنبيه هام',
      body: longBody,
      clientRequestId: 'req-long-body',
      status: 'SENDING',
    });

    // Mock global fetch for Expo Push API
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'ok', id: 'ticket-1' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await ParentPushService._sendTeacherMessage(msg._id.toString());
    expect(res.insertedCount).toBe(1);
    expect(res.pushCount).toBe(1);

    // Verify stored notification document has FULL body
    const savedNotif = await ParentNotificationModel.findOne({
      eventId: `teacher_message:${msg._id.toString()}`,
    });
    expect(savedNotif).toBeDefined();
    expect(savedNotif?.body).toBe(longBody);

    // Verify Expo push message received TRUNCATED body with ellipsis
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchCall = fetchMock.mock.calls[0];
    const sentMessages = JSON.parse(fetchCall[1].body);
    expect(sentMessages[0].body.length).toBeLessThanOrEqual(180);
    expect(sentMessages[0].body.endsWith('...')).toBe(true);
    expect(sentMessages[0].body).toBe(longBody.slice(0, 177) + '...');
  });

  it('should group multiple children for same parent into single notification with studentIds and studentNames in data', async () => {
    const parent = await ParentModel.create({
      phone: '01033333333',
      name: 'أبو أحمد وعلي',
      isActive: true,
    });

    const child1 = await StudentModel.create({
      studentName: 'أحمد سعيد',
      parentName: 'سعيد',
      gradeLevel: GradeLevel.SEC_1,
      studentCode: '11A',
      teacherId: teacher._id,
      groupId: new mongoose.Types.ObjectId(),
      isActive: true,
      remainingSessions: 4,
    });

    const child2 = await StudentModel.create({
      studentName: 'علي سعيد',
      parentName: 'سعيد',
      gradeLevel: GradeLevel.SEC_1,
      studentCode: '11B',
      teacherId: teacher._id,
      groupId: new mongoose.Types.ObjectId(),
      isActive: true,
      remainingSessions: 4,
    });

    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: child1._id,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    await ParentStudentModel.create({
      parentId: parent._id,
      studentId: child2._id,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });

    const msg = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GRADE',
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة للأخوين معاً',
      clientRequestId: 'req-siblings',
      status: 'SENDING',
    });

    const res = await ParentPushService._sendTeacherMessage(msg._id.toString());
    expect(res.insertedCount).toBe(1);

    const notifs = await ParentNotificationModel.find({
      parentId: parent._id,
      eventId: `teacher_message:${msg._id.toString()}`,
    });

    expect(notifs.length).toBe(1);
    expect(notifs[0]?.data?.studentNames).toEqual(
      expect.arrayContaining(['أحمد سعيد', 'علي سعيد'])
    );
    expect(notifs[0]?.data?.studentIds).toHaveLength(2);
  });

  it('should mark message as FAILED if an unhandled error occurs during execution', async () => {
    const msg = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GRADE',
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة ستفشل',
      clientRequestId: 'req-fail',
      status: 'SENDING',
    });

    // Force an error in StudentModel.find
    vi.spyOn(StudentModel, 'find').mockImplementationOnce(() => {
      throw new Error('Database connection lost');
    });

    const res = await ParentPushService._sendTeacherMessage(msg._id.toString());
    expect(res).toEqual({ insertedCount: 0, pushCount: 0 });

    const updatedMsg = await TeacherMessageModel.findById(msg._id);
    expect(updatedMsg?.status).toBe('FAILED');
  });
});
