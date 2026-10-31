import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import {
  makeTeacherToken,
  makeAssistantToken,
  bearerHeader,
} from '../helpers/auth.helper.js';
import {
  seedTeacher,
  seedAssistant,
  seedGroup,
  seedStudent,
  seedOtherTeacher,
} from '../helpers/seed.helper.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';
import { TeacherMessageModel } from '../../src/database/models/teacher-message.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { TokenUtil } from '../../src/common/utils/token.util.js';

describe('Phase 2 Integration: Teacher Messages API & End-to-End Delivery', () => {
  let app: ReturnType<typeof getTestApp>;
  let teacher: any;
  let teacherToken: string;

  beforeEach(async () => {
    app = getTestApp();
    teacher = await seedTeacher({
      name: 'أستاذ أحمد محمود',
      subject: 'لغة عربية',
    });
    teacherToken = makeTeacherToken({ userId: teacher._id.toString() });

    await ParentNotificationModel.createIndexes();
    await TeacherMessageModel.createIndexes();

    // Mock Expo push fetch so network calls are mocked
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'expo-ticket-1' }] }),
    }));
  });

  async function waitForMessageSent(messageId: string) {
    for (let i = 0; i < 30; i++) {
      const msg = await TeacherMessageModel.findById(messageId);
      if (msg?.status === 'SENT' || msg?.status === 'FAILED') {
        return msg;
      }
      await new Promise((r) => setTimeout(r, 40));
    }
    return TeacherMessageModel.findById(messageId);
  }

  async function createParentWithDevice(phone: string, name: string) {
    const parent = await ParentModel.create({
      phone,
      name,
      isActive: true,
    });
    await ParentDeviceModel.create({
      parentId: parent._id,
      deviceId: `device-${phone}`,
      fcmToken: `ExponentPushToken[token-${phone}]`,
      refreshTokenHash: `hash-${phone}`,
      platform: 'android',
      isActive: true,
    });
    return parent;
  }

  async function linkStudent(studentId: any, parentId: any) {
    return ParentStudentModel.create({
      parentId,
      studentId,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
    });
  }

  // ─── T1: Group Broadcast ───────────────────────────────────────────────────
  it('T1: إرسال لمجموعة فيها 3 طلاب (2 مربوطان بولي أمر) ينشئ إشعارين ويحدث السجل بـ reachedParentCount=2', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

    const s1 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const s2 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const s3 = await seedStudent(group._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

    const p1 = await createParentWithDevice('01011110001', 'ولي أمر 1');
    const p2 = await createParentWithDevice('01011110002', 'ولي أمر 2');

    await linkStudent(s1._id, p1._id);
    await linkStudent(s2._id, p2._id);
    // s3 remains unlinked

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: group._id.toString(),
        title: 'واجب الحصة القادمة',
        body: 'يرجى حل التمارين ص 45 في كتاب التدريبات.',
        clientRequestId: 'req-t1',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SENDING');
    expect(res.body.data.targetStudentCount).toBe(3);
    expect(res.body.data.reachedParentCount).toBe(2);

    const updatedMsg = await waitForMessageSent(res.body.data._id);
    expect(updatedMsg?.status).toBe('SENT');
    expect(updatedMsg?.reachedParentCount).toBe(2);
    expect(updatedMsg?.pushSentCount).toBe(2);

    const notifications = await ParentNotificationModel.find({
      eventId: `teacher_message:${res.body.data._id}`,
    });
    expect(notifications.length).toBe(2);
  });

  // ─── T2: Grade Broadcast ───────────────────────────────────────────────────
  it('T2: إرسال لمرحلة يشمل طلاباً من مجموعتين ولا يرسل لمرحلة أخرى', async () => {
    const g1 = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_2 });
    const g2 = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_2 });
    const gOther = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

    const s1 = await seedStudent(g1._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_2 });
    const s2 = await seedStudent(g2._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_2 });
    const sOther = await seedStudent(gOther._id, { teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });

    const p1 = await createParentWithDevice('01022220001', 'ولي أمر ثانية');
    const p2 = await createParentWithDevice('01022220002', 'ولي أمر ثانية آخر');
    const pOther = await createParentWithDevice('01022220003', 'ولي أمر أولى');

    await linkStudent(s1._id, p1._id);
    await linkStudent(s2._id, p2._id);
    await linkStudent(sOther._id, pOther._id);

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GRADE',
        gradeLevel: GradeLevel.SEC_2,
        body: 'رسالة خاصة بطلاب الصف الثاني الثانوي فقط.',
        clientRequestId: 'req-t2',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.targetStudentCount).toBe(2);
    expect(res.body.data.reachedParentCount).toBe(2);

    await waitForMessageSent(res.body.data._id);

    const pOtherNotifs = await ParentNotificationModel.find({
      parentId: pOther._id,
      eventId: `teacher_message:${res.body.data._id}`,
    });
    expect(pOtherNotifs.length).toBe(0);
  });

  // ─── T3: Sibling Single Notification ───────────────────────────────────────
  it('T3: ولي أمر لأخوين في نفس المجموعة يستقبل إشعاراً واحداً و data.studentIds يحوي الاثنين', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const child1 = await seedStudent(group._id, { teacherId: teacher._id, studentName: 'أحمد سامح' });
    const child2 = await seedStudent(group._id, { teacherId: teacher._id, studentName: 'زياد سامح' });

    const parent = await createParentWithDevice('01033330001', 'سامح');
    await linkStudent(child1._id, parent._id);
    await linkStudent(child2._id, parent._id);

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: group._id.toString(),
        body: 'رسالة للأخوين معاً',
        clientRequestId: 'req-t3',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reachedParentCount).toBe(1);

    await waitForMessageSent(res.body.data._id);

    const notifs = await ParentNotificationModel.find({
      parentId: parent._id,
      eventId: `teacher_message:${res.body.data._id}`,
    });

    expect(notifs.length).toBe(1);
    expect(notifs[0]?.data?.studentIds).toHaveLength(2);
    expect(notifs[0]?.data?.studentNames).toEqual(expect.arrayContaining(['أحمد سامح', 'زياد سامح']));
  });

  // ─── T4: Inactive Student & Tenant Isolation ───────────────────────────────
  it('T4: طالب غير نشط أو تابع لمدرس آخر لا يصل ولي أمره أي إشعار', async () => {
    const otherTeacher = await seedOtherTeacher();
    const gOther = await seedGroup({ teacherId: otherTeacher._id, gradeLevel: GradeLevel.SEC_1 });
    const sOtherTeacher = await seedStudent(gOther._id, {
      teacherId: otherTeacher._id,
      gradeLevel: GradeLevel.SEC_1,
    });

    const myGroup = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const myActiveStudent = await seedStudent(myGroup._id, {
      teacherId: teacher._id,
      gradeLevel: GradeLevel.SEC_1,
    });
    const myInactiveStudent = await seedStudent(myGroup._id, {
      teacherId: teacher._id,
      gradeLevel: GradeLevel.SEC_1,
      isActive: false,
    });

    const pActive = await createParentWithDevice('01044440001', 'ولي أمر طالب نشط');
    const pInactive = await createParentWithDevice('01044440002', 'ولي أمر طالب معطل');
    const pOtherTeacher = await createParentWithDevice('01044440003', 'ولي أمر مدرس آخر');

    await linkStudent(myActiveStudent._id, pActive._id);
    await linkStudent(myInactiveStudent._id, pInactive._id);
    await linkStudent(sOtherTeacher._id, pOtherTeacher._id);

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GRADE',
        gradeLevel: GradeLevel.SEC_1,
        body: 'رسالة خاصة بطلابي النشطين فقط',
        clientRequestId: 'req-t4',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.targetStudentCount).toBe(1);
    expect(res.body.data.reachedParentCount).toBe(1);

    await waitForMessageSent(res.body.data._id);

    expect(
      await ParentNotificationModel.countDocuments({
        parentId: pInactive._id,
        eventId: `teacher_message:${res.body.data._id}`,
      })
    ).toBe(0);

    expect(
      await ParentNotificationModel.countDocuments({
        parentId: pOtherTeacher._id,
        eventId: `teacher_message:${res.body.data._id}`,
      })
    ).toBe(0);
  });

  // ─── T5: Group Scope Validation ────────────────────────────────────────────
  it('T5: groupId تابع لمدرس آخر يرجع 404 ولا ينشئ أي سجل', async () => {
    const otherTeacher = await seedOtherTeacher();
    const otherGroup = await seedGroup({ teacherId: otherTeacher._id });

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: otherGroup._id.toString(),
        body: 'رسالة لن تمر',
        clientRequestId: 'req-t5',
      });

    expect(res.status).toBe(404);
    expect(await TeacherMessageModel.countDocuments()).toBe(0);
  });

  // ─── T6: Assistant Authorization Forbidden ─────────────────────────────────
  it('T6: المساعد ممنوع من إرسال الرسائل ويرجع 403', async () => {
    const assistant = await seedAssistant({ teacherId: teacher._id });
    const assistantToken = makeAssistantToken({
      userId: assistant._id.toString(),
      teacherId: teacher._id.toString(),
    });

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(assistantToken))
      .send({
        targetType: 'GRADE',
        gradeLevel: GradeLevel.SEC_1,
        body: 'محاولة إرسال من مساعد',
        clientRequestId: 'req-t6',
      });

    expect(res.status).toBe(403);
  });

  // ─── T7: Idempotency ───────────────────────────────────────────────────────
  it('T7: نفس clientRequestId مرتين يرجع نفس السجل بلا تكرار', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const student = await seedStudent(group._id, { teacherId: teacher._id });
    const parent = await createParentWithDevice('01077770001', 'ولي أمر تكرار');
    await linkStudent(student._id, parent._id);

    const payload = {
      targetType: 'GROUP',
      groupId: group._id.toString(),
      body: 'رسالة باختبار الـ idempotency',
      clientRequestId: 'req-unique-key-777',
    };

    const res1 = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send(payload);

    expect(res1.status).toBe(201);
    const msgId1 = res1.body.data._id;

    const res2 = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.body.data._id).toBe(msgId1);
    expect(await TeacherMessageModel.countDocuments()).toBe(1);
  });

  // ─── T8: Strict No-Regex Fallback ──────────────────────────────────────────
  it('T8: طالب بلا ParentStudent لكن رقم ولي أمره مطابق لـ Parent موجود لا يستقبل إشعاراً', async () => {
    const matchingPhone = '01088880001';
    const parent = await createParentWithDevice(matchingPhone, 'ولي أمر موجود مسبقاً');

    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    // Student has parentPhone matching parent, but NO ParentStudent record
    const sNoLink = await seedStudent(group._id, {
      teacherId: teacher._id,
      parentPhone: matchingPhone,
    });

    // Another student with an active link so message creation passes zero-audience check
    const sLinked = await seedStudent(group._id, { teacherId: teacher._id });
    const pLinked = await createParentWithDevice('01088880002', 'ولي أمر مربوط');
    await linkStudent(sLinked._id, pLinked._id);

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: group._id.toString(),
        body: 'اختبار عدم استخدام الـ regex fallback',
        clientRequestId: 'req-t8',
      });

    expect(res.status).toBe(201);
    await waitForMessageSent(res.body.data._id);

    // Assert NO ParentStudent record was created for sNoLink
    const createdLink = await ParentStudentModel.findOne({ studentId: sNoLink._id });
    expect(createdLink).toBeNull();

    // Assert parent without link received NO notification
    const unlinkedNotif = await ParentNotificationModel.findOne({
      parentId: parent._id,
      eventId: `teacher_message:${res.body.data._id}`,
    });
    expect(unlinkedNotif).toBeNull();
  });

  // ─── T9: GET History ───────────────────────────────────────────────────────
  it('T9: GET /teacher-messages يرجع سجلات المدرس مرتبة تنازلياً مع pagination', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const student = await seedStudent(group._id, { teacherId: teacher._id });
    const parent = await createParentWithDevice('01099990001', 'ولي أمر سجل');
    await linkStudent(student._id, parent._id);

    // Create 3 messages with staggered timestamps
    const m1 = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GROUP',
      groupId: group._id,
      groupName: group.name,
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة 1',
      clientRequestId: 'req-m1',
      status: 'SENT',
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
    });

    const m2 = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GROUP',
      groupId: group._id,
      groupName: group.name,
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة 2',
      clientRequestId: 'req-m2',
      status: 'SENT',
      createdAt: new Date('2026-10-02T10:00:00.000Z'),
    });

    const res = await app
      .get('/teacher-messages?page=1&limit=10')
      .set('Authorization', bearerHeader(teacherToken));

    expect(res.status).toBe(200);
    expect(res.body.data.messages.length).toBe(2);
    expect(res.body.data.messages[0]._id).toBe(m2._id.toString());
    expect(res.body.data.messages[1]._id).toBe(m1._id.toString());
    expect(res.body.data.total).toBe(2);
  });

  // ─── T10: Validation Rejection ─────────────────────────────────────────────
  it('T10: يرفض الرسالة الفارغة أو أطول من 1000 حرف أو استهداف بلا معرف بـ 400', async () => {
    // 1. Empty body
    const resEmpty = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GRADE',
        gradeLevel: GradeLevel.SEC_1,
        body: '   ',
        clientRequestId: 'req-empty',
      });
    expect(resEmpty.status).toBe(400);

    // 2. Body > 1000 characters
    const resTooLong = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GRADE',
        gradeLevel: GradeLevel.SEC_1,
        body: 'أ'.repeat(1001),
        clientRequestId: 'req-long',
      });
    expect(resTooLong.status).toBe(400);

    // 3. GROUP without groupId
    const resNoGroup = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        body: 'نص صالح',
        clientRequestId: 'req-nogroup',
      });
    expect(resNoGroup.status).toBe(400);
  });

  // ─── T11: Compatibility with Parent App GET /parent/notifications ──────────
  it('T11: GET /parent/notifications يعرض رسالة المدرس بالنوع الجديد TEACHER_MESSAGE بشكل سليم', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const student = await seedStudent(group._id, { teacherId: teacher._id });
    const parent = await createParentWithDevice('01012345001', 'ولي أمر تطبيق');
    await linkStudent(student._id, parent._id);

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: group._id.toString(),
        title: 'رسالة إخبارية',
        body: 'أهلاً بكم في الفصل الدراسي الجديد.',
        clientRequestId: 'req-t11',
      });

    await waitForMessageSent(res.body.data._id);

    // Generate parent JWT
    const parentToken = TokenUtil.generateAccessToken({
      parentId: parent._id.toString(),
      phone: parent.phone,
      deviceId: `device-${parent.phone}`,
      role: 'parent',
      isActive: true,
    } as any);

    const parentRes = await app
      .get('/parent/notifications')
      .set('Authorization', bearerHeader(parentToken));

    expect(parentRes.status).toBe(200);
    const notifications = parentRes.body.data.notifications;
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    const teacherMsg = notifications.find((n: any) => n.type === 'TEACHER_MESSAGE');
    expect(teacherMsg).toBeDefined();
    expect(teacherMsg.body).toBe('أهلاً بكم في الفصل الدراسي الجديد.');
    expect(teacherMsg.data.kind).toBe('TEACHER_MESSAGE');
    expect(teacherMsg.data.studentNames).toContain(student.studentName);
  });

  // ─── T12: Zero Audience Prevention (User Note 1) ───────────────────────────
  it('T12: يمنع الإرسال الصفري (reachedParentCount === 0) ويرجع 400 ولا ينشئ سجل رسالة', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    // Student exists in group, but NO parent is linked
    await seedStudent(group._id, { teacherId: teacher._id });

    const res = await app
      .post('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        targetType: 'GROUP',
        groupId: group._id.toString(),
        body: 'رسالة لن ترسل بسبب عدم وجود أولياء أمور',
        clientRequestId: 'req-t12',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('لا يوجد أولياء أمور مربوطين');
    expect(await TeacherMessageModel.countDocuments()).toBe(0);
  });

  // ─── T13: Recovery of Stuck SENDING Messages (User Note 3) ──────────────────
  it('T13: الرسائل المعلقة في SENDING لأكثر من 5 دقائق تعتبر FAILED وتُحدث تلقائياً', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);

    const stuckMsg = await TeacherMessageModel.create({
      teacherId: teacher._id,
      sentBy: teacher._id,
      targetType: 'GROUP',
      groupId: group._id,
      groupName: group.name,
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة علقت في الإرسال',
      clientRequestId: 'req-stuck',
      status: 'SENDING',
      createdAt: sixMinutesAgo,
    });

    const res = await app
      .get('/teacher-messages')
      .set('Authorization', bearerHeader(teacherToken));

    expect(res.status).toBe(200);
    const updated = await TeacherMessageModel.findById(stuckMsg._id);
    expect(updated?.status).toBe('FAILED');
  });

  // ─── T14: Audience Preview ─────────────────────────────────────────────────
  it('T14: GET /teacher-messages/audience يرجع أعداد الطلاب وأولياء الأمور المربوطين بدقة', async () => {
    const group = await seedGroup({ teacherId: teacher._id, gradeLevel: GradeLevel.SEC_1 });
    const s1 = await seedStudent(group._id, { teacherId: teacher._id });
    const s2 = await seedStudent(group._id, { teacherId: teacher._id });
    const p1 = await createParentWithDevice('01014140001', 'ولي أمر 14');
    await linkStudent(s1._id, p1._id);

    const res = await app
      .get(`/teacher-messages/audience?targetType=GROUP&groupId=${group._id.toString()}`)
      .set('Authorization', bearerHeader(teacherToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      targetStudentCount: 2,
      reachedParentCount: 1,
      studentsWithoutParentCount: 1,
    });
  });
});
