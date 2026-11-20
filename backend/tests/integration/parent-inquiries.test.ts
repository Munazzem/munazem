import { describe, it, expect, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
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
  seedSession,
  seedAttendance,
} from '../helpers/db.helper.js';
import { AttendanceStatus, GradeLevel, UserRole } from '../../src/common/enums/enum.service.js';
import { ParentInquiryModel } from '../../src/database/models/parent-inquiry.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentDeviceModel } from '../../src/database/models/parent-device.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { TokenUtil } from '../../src/common/utils/token.util.js';
import { cache } from '../../src/infrastructure/cache/cache.service.js';

describe('Phase 3 Integration: Parent Inquiries APIs, RBAC, State Machine & Race Conditions', () => {
  let app: ReturnType<typeof getTestApp>;
  let teacher: any;
  let teacherToken: string;
  let assistantWithPerm: any;
  let assistantWithPermToken: string;
  let assistantNoPerm: any;
  let assistantNoPermToken: string;
  let group: any;
  let student1: any;
  let student2: any;
  let parent: any;
  let parentToken: string;

  async function createAuthenticatedParent(phone: string, name: string) {
    const p = await ParentModel.create({
      phone,
      name,
      isActive: true,
    });
    const deviceId = `device-${phone}`;
    await ParentDeviceModel.create({
      parentId: p._id,
      deviceId,
      fcmToken: `ExponentPushToken[token-${phone}]`,
      refreshTokenHash: `hash-${phone}`,
      platform: 'android',
      isActive: true,
    });
    const token = TokenUtil.generateAccessToken({
      parentId: p._id.toString(),
      phone: p.phone,
      deviceId,
      role: 'parent',
      isActive: true,
    } as any);
    return { parent: p, token };
  }

  async function linkParentToStudent(
    parentId: mongoose.Types.ObjectId,
    studentId: mongoose.Types.ObjectId,
    overrides: Record<string, any> = {}
  ) {
    return ParentStudentModel.create({
      parentId,
      studentId,
      status: 'ACTIVE',
      studentModelType: 'Student',
      verifiedVia: 'AUTO_CONFIRMED',
      ...overrides,
    });
  }

  beforeEach(async () => {
    app = getTestApp();
    await ParentInquiryModel.createIndexes();
    await ParentNotificationModel.createIndexes();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ status: 'ok', id: 'expo-ticket-1' }] }),
      })
    );

    teacher = await seedTeacher({
      name: 'أ/ محمود عبد العزيز',
      subject: 'كيمياء',
    });
    teacherToken = makeTeacherToken({ userId: teacher._id.toString() });

    assistantWithPerm = await seedAssistant({
      name: 'سارة الأسيستنت',
      phone: '01100000011',
      teacherId: teacher._id,
      assistantPermissions: {
        canTakeAttendance: true,
        canEditAttendance: true,
        canViewAttendance: true,
        canManageSessions: true,
        canRecordPayments: true,
        canViewFinancials: true,
        canManageStudents: true,
        canManageGroups: true,
        canCreateExams: true,
        canGradeExams: true,
        canManageNotebooks: true,
        canSendNotifications: true,
        canManageInquiries: true,
      },
    });
    await cache.del(`assistant:perms:${assistantWithPerm._id.toString()}`);
    assistantWithPermToken = makeAssistantToken({
      userId: assistantWithPerm._id.toString(),
      teacherId: teacher._id.toString(),
    });

    assistantNoPerm = await UserModel.create({
      name: 'مساعد بدون صلاحية استفسارات',
      phone: '01100000022',
      password: '$2b$10$placeholder.hashed.password.not.used.in.tests',
      role: UserRole.assistant,
      teacherId: teacher._id,
      isActive: true,
      // relies on default canManageInquiries: false
    });
    await cache.del(`assistant:perms:${assistantNoPerm._id.toString()}`);
    assistantNoPermToken = makeAssistantToken({
      userId: assistantNoPerm._id.toString(),
      teacherId: teacher._id.toString(),
    });

    group = await seedGroup({
      teacherId: teacher._id,
      name: 'مجموعة السبت والثلاثاء',
      gradeLevel: GradeLevel.SEC_2,
    });

    student1 = await seedStudent(group._id, {
      teacherId: teacher._id,
      studentName: 'يوسف طارق',
      studentCode: '101A',
      gradeLevel: GradeLevel.SEC_2,
      totalDebt: 150,
      remainingSessions: 5,
      cycleNumber: 2,
      cycleCapacity: 8,
      consecutiveAbsences: 1,
    });

    student2 = await seedStudent(group._id, {
      teacherId: teacher._id,
      studentName: 'مريم طارق',
      studentCode: '102A',
      gradeLevel: GradeLevel.SEC_2,
    });

    const authParent = await createAuthenticatedParent('01055550001', 'طارق ولي الأمر');
    parent = authParent.parent;
    parentToken = authParent.token;

    await linkParentToStudent(parent._id, student1._id);
    await linkParentToStudent(parent._id, student2._id);
  });

  // ── 1. Creation, Idempotency & Active Inquiry Limit ────────────────────────
  it('T1: creates inquiry (201) deriving teacherId from student and ignoring forged teacherId in body, and returns 200 on idempotent replay', async () => {
    const forgedTeacherId = new mongoose.Types.ObjectId().toString();

    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        teacherId: forgedTeacherId, // forged! must be ignored
        category: 'FINANCIAL',
        body: '  هل يمكن تأجيل قسط الشهر للأسبوع القادم؟  ',
        clientRequestId: 'client-req-t1',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.teacherId).toBe(teacher._id.toString());
    expect(createRes.body.data.teacherId).not.toBe(forgedTeacherId);
    expect(createRes.body.data.status).toBe('PENDING');
    expect(createRes.body.data.isOpen).toBe(true);
    expect(createRes.body.data.assignedTo).toBe('ASSISTANT');
    expect(createRes.body.data.studentName).toBe('يوسف طارق');
    expect(createRes.body.data.groupName).toBe('مجموعة السبت والثلاثاء');
    expect(createRes.body.data.body).toBe('هل يمكن تأجيل قسط الشهر للأسبوع القادم؟');

    // Idempotent replay with same clientRequestId -> 200 OK with same _id
    const replayRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'FINANCIAL',
        body: 'هل يمكن تأجيل قسط الشهر للأسبوع القادم؟',
        clientRequestId: 'client-req-t1',
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data._id).toBe(createRes.body.data._id);

    const totalCount = await ParentInquiryModel.countDocuments({ parentId: parent._id });
    expect(totalCount).toBe(1);
  });

  it('T2: rejects second active inquiry for same student with 409 ACTIVE_INQUIRY_EXISTS + activeInquiryId, while allowing parallel inquiry for sibling', async () => {
    const firstRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'ABSENCE_EXCUSE',
        body: 'اعتذار عن حصة اليوم',
        clientRequestId: 'req-t2-first',
      });
    expect(firstRes.status).toBe(201);

    // Attempt second active inquiry for student1 with different clientRequestId
    const secondRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'GENERAL',
        body: 'طلب آخر لنفس الطالب',
        clientRequestId: 'req-t2-second',
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.code).toBe('ACTIVE_INQUIRY_EXISTS');
    expect(secondRes.body.data?.activeInquiryId).toBe(firstRes.body.data._id);

    // Parallel active inquiry for sibling (student2) succeeds
    const siblingRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student2._id.toString(),
        category: 'ACADEMIC_LEVEL',
        body: 'استفسار عن درجات مريم',
        clientRequestId: 'req-t2-sibling',
      });

    expect(siblingRes.status).toBe(201);
  });

  it('T3: rejects unlinked/revoked student (403 STUDENT_NOT_LINKED), center student (403 UNSUPPORTED_STUDENT), and invalid ObjectId (400)', async () => {
    // 1. Invalid ObjectId -> 400
    const badIdRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: 'not-a-valid-mongo-id',
        category: 'GENERAL',
        body: 'نص الرسالة',
        clientRequestId: 'req-bad-id',
      });
    expect(badIdRes.status).toBe(400);

    const badParamRes = await app
      .get('/parent/inquiries/invalid-id-123')
      .set('Authorization', bearerHeader(parentToken));
    expect(badParamRes.status).toBe(400);

    // 2. Unlinked student -> 403 STUDENT_NOT_LINKED
    const unlinkedStudent = await seedStudent(group._id, {
      teacherId: teacher._id,
      studentName: 'طالب غير مرتبط',
      studentCode: '999A',
    });

    const unlinkedRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: unlinkedStudent._id.toString(),
        category: 'GENERAL',
        body: 'محاولة إرسال لطالب غير مرتبط',
        clientRequestId: 'req-unlinked',
      });
    expect(unlinkedRes.status).toBe(403);
    expect(unlinkedRes.body.code).toBe('STUDENT_NOT_LINKED');

    // 3. Center student (centerId !== null) -> 403 UNSUPPORTED_STUDENT
    const centerStudent = await seedStudent(group._id, {
      teacherId: teacher._id,
      studentName: 'طالب سنتر',
      studentCode: '888C',
      centerId: new mongoose.Types.ObjectId(),
    });
    await linkParentToStudent(parent._id, centerStudent._id);

    const centerRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: centerStudent._id.toString(),
        category: 'GENERAL',
        body: 'محاولة إرسال لطالب سنتر',
        clientRequestId: 'req-center-student',
      });
    expect(centerRes.status).toBe(403);
    expect(centerRes.body.code).toBe('UNSUPPORTED_STUDENT');
  });

  // ── 2. Editing & Cancellation Lifecycle ────────────────────────────────────
  it('T4: allows editing PENDING inquiry up to 3 times, rejects 4th edit with 409 EDIT_LIMIT_REACHED, and rejects editing after ESCALATED/REPLIED with 409 NOT_EDITABLE', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'GROUP_CHANGE',
        body: 'النص الأصلي',
        clientRequestId: 'req-t4',
      });
    const inquiryId = createRes.body.data._id;

    for (let i = 1; i <= 3; i++) {
      const editRes = await app
        .patch(`/parent/inquiries/${inquiryId}`)
        .set('Authorization', bearerHeader(parentToken))
        .send({ body: `النص المعدل رقم ${i}` });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.editCount).toBe(i);
      expect(editRes.body.data.body).toBe(`النص المعدل رقم ${i}`);
      expect(editRes.body.data.editedAt).toBeTruthy();
    }

    // 4th edit must fail with 409 EDIT_LIMIT_REACHED
    const fourthEditRes = await app
      .patch(`/parent/inquiries/${inquiryId}`)
      .set('Authorization', bearerHeader(parentToken))
      .send({ body: 'التعديل الرابع المرفوض' });

    expect(fourthEditRes.status).toBe(409);
    expect(fourthEditRes.body.code).toBe('EDIT_LIMIT_REACHED');

    // Create inquiry on student2, escalate it, and verify parent cannot edit or cancel it
    const createRes2 = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student2._id.toString(),
        category: 'GENERAL',
        body: 'طلب سيتم تحويله للمستر',
        clientRequestId: 'req-t4-s2',
      });
    const inquiry2Id = createRes2.body.data._id;

    const escRes = await app
      .post(`/inquiries/${inquiry2Id}/escalate`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({ note: 'يحتاج قرار المستر' });
    expect(escRes.status).toBe(200);

    const editAfterEscRes = await app
      .patch(`/parent/inquiries/${inquiry2Id}`)
      .set('Authorization', bearerHeader(parentToken))
      .send({ body: 'محاولة تعديل بعد التصعيد' });
    expect(editAfterEscRes.status).toBe(409);
    expect(editAfterEscRes.body.code).toBe('NOT_EDITABLE');

    const cancelAfterEscRes = await app
      .post(`/parent/inquiries/${inquiry2Id}/cancel`)
      .set('Authorization', bearerHeader(parentToken));
    expect(cancelAfterEscRes.status).toBe(409);
    expect(cancelAfterEscRes.body.code).toBe('NOT_CANCELLABLE');
  });

  it('T5: soft-cancels PENDING inquiry (status=CANCELLED, cancelledAt set, isOpen=false) and immediately unlocks creating a new inquiry for the same student', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'GENERAL',
        body: 'طلب سيتم إلغاؤه',
        clientRequestId: 'req-t5-1',
      });
    const inquiryId = createRes.body.data._id;

    const cancelRes = await app
      .post(`/parent/inquiries/${inquiryId}/cancel`)
      .set('Authorization', bearerHeader(parentToken));

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.isOpen).toBe(false);
    expect(cancelRes.body.data.cancelledAt).toBeTruthy();

    // Immediate new inquiry for same student must succeed
    const newCreateRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'FINANCIAL',
        body: 'طلب جديد بعد الإلغاء مباشرًة',
        clientRequestId: 'req-t5-2',
      });
    expect(newCreateRes.status).toBe(201);
    expect(newCreateRes.body.data.isOpen).toBe(true);
  });

  // ── 3. Tenant Isolation & RBAC ─────────────────────────────────────────────
  it('T6: enforces tenant isolation (other teacher gets 404), blocks assistant without canManageInquiries (403), and enforces read-only ESCALATED for assistant (403 TEACHER_ONLY)', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'ACADEMIC_LEVEL',
        body: 'سؤال عن الامتحان الشامل',
        clientRequestId: 'req-t6',
      });
    const inquiryId = createRes.body.data._id;

    // 1. Assistant without canManageInquiries -> 403
    const noPermListRes = await app
      .get('/inquiries')
      .set('Authorization', bearerHeader(assistantNoPermToken));
    expect(noPermListRes.status).toBe(403);

    const noPermReplyRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(assistantNoPermToken))
      .send({ body: 'رد غير مصرح', clientRequestId: 'rep-noperm' });
    expect(noPermReplyRes.status).toBe(403);

    // 2. Other teacher (different tenant) -> 404 on GET and POST reply
    const otherTeacher = await UserModel.create({
      name: 'معلم آخر مستقل',
      phone: '01099887766',
      password: 'hashed-password',
      role: UserRole.teacher,
      isActive: true,
    });
    const otherTeacherToken = makeTeacherToken({
      userId: otherTeacher._id.toString(),
    });

    const crossTenantGetRes = await app
      .get(`/inquiries/${inquiryId}`)
      .set('Authorization', bearerHeader(otherTeacherToken));
    expect(crossTenantGetRes.status).toBe(404);

    const crossTenantReplyRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(otherTeacherToken))
      .send({ body: 'رد من مستأجر آخر', clientRequestId: 'rep-cross' });
    expect(crossTenantReplyRes.status).toBe(404);

    // 3. Assistant WITH permission escalates inquiry to teacher
    const escalateRes = await app
      .post(`/inquiries/${inquiryId}/escalate`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({ note: 'سؤال فني خاص بالمستر' });
    expect(escalateRes.status).toBe(200);
    expect(escalateRes.body.data.status).toBe('ESCALATED');
    expect(escalateRes.body.data.assignedTo).toBe('TEACHER');
    expect(escalateRes.body.data.escalationNote).toBe('سؤال فني خاص بالمستر');

    // Assistant can still read ESCALATED inquiry
    const assistantReadEscalated = await app
      .get(`/inquiries/${inquiryId}`)
      .set('Authorization', bearerHeader(assistantWithPermToken));
    expect(assistantReadEscalated.status).toBe(200);

    // Assistant CANNOT reply to ESCALATED inquiry -> 403 TEACHER_ONLY
    const assistantReplyEscalated = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({
        body: 'محاولة رد من الأسيستنت بعد التصعيد',
        clientRequestId: 'rep-ast-esc',
      });
    expect(assistantReplyEscalated.status).toBe(403);
    expect(assistantReplyEscalated.body.code).toBe('TEACHER_ONLY');

    // Teacher CAN reply to ESCALATED inquiry -> 200
    const teacherReplyRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(teacherToken))
      .send({
        body: 'رد المستر على السؤال الفني',
        clientRequestId: 'rep-teacher-esc',
      });
    expect(teacherReplyRes.status).toBe(200);
    expect(teacherReplyRes.body.data.status).toBe('REPLIED');
    expect(teacherReplyRes.body.data.isOpen).toBe(false);
    expect(teacherReplyRes.body.data.reply.repliedByRole).toBe('teacher');
    expect(teacherReplyRes.body.data.reply.repliedByName).toBe('أ/ محمود عبد العزيز');
  });

  // ── 4. Student Context & Counts ────────────────────────────────────────────
  it('T7: returns accurate /inquiries/counts and computes live studentContext (30-day attendance + financial summary) on GET /inquiries/:id', async () => {
    // Seed 2 sessions and attendance records for student1 within last 30 days
    const session1 = await seedSession({
      groupId: group._id,
      teacherId: teacher._id,
    });
    const session2 = await seedSession({
      groupId: group._id,
      teacherId: teacher._id,
    });
    await seedAttendance(session1._id, student1._id, {
      status: AttendanceStatus.PRESENT,
    });
    await seedAttendance(session2._id, student1._id, {
      status: AttendanceStatus.ABSENT,
    });

    // Create 2 inquiries: 1 stays PENDING (assistant), 1 gets ESCALATED (teacher)
    const inq1Res = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'FINANCIAL',
        body: 'استفسار الأول',
        clientRequestId: 'req-t7-1',
      });
    const inq1Id = inq1Res.body.data._id;

    const inq2Res = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student2._id.toString(),
        category: 'GENERAL',
        body: 'استفسار الثاني',
        clientRequestId: 'req-t7-2',
      });
    const inq2Id = inq2Res.body.data._id;

    await app
      .post(`/inquiries/${inq2Id}/escalate`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({ note: 'للمستر' });

    // Check /inquiries/counts
    const countsRes = await app
      .get('/inquiries/counts')
      .set('Authorization', bearerHeader(assistantWithPermToken));

    expect(countsRes.status).toBe(200);
    expect(countsRes.body.data).toEqual({
      assistantOpen: 1,
      escalatedOpen: 1,
      totalOpen: 2,
    });

    // Check GET /inquiries/:id with computed studentContext
    const detailRes = await app
      .get(`/inquiries/${inq1Id}`)
      .set('Authorization', bearerHeader(assistantWithPermToken));

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.inquiry._id).toBe(inq1Id);
    const ctx = detailRes.body.data.studentContext;
    expect(ctx).toBeDefined();
    expect(ctx.studentName).toBe('يوسف طارق');
    expect(ctx.studentCode).toBe('101A');
    expect(ctx.groupName).toBe('مجموعة السبت والثلاثاء');
    expect(ctx.attendanceLast30Days).toMatchObject({
      present: 1,
      absent: 1,
      late: 0,
      excused: 0,
      consecutiveAbsences: 1,
    });
    expect(ctx.financial).toMatchObject({
      totalDebt: 150,
      hasOutstandingDebt: true,
      remainingSessions: 5,
      cycleNumber: 2,
      cycleCapacity: 8,
    });
  });

  // ── 5. Race Conditions & Optimistic Concurrency ────────────────────────────
  it('T8 (Race Condition): concurrent replies from two staff members — exactly one succeeds (200) and the other gets 409 ALREADY_REPLIED; same clientRequestId replay returns 200', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'GENERAL',
        body: 'استفسار سباق الردود',
        clientRequestId: 'req-t8',
      });
    const inquiryId = createRes.body.data._id;

    // Fire two concurrent replies with different clientRequestIds
    const [resA, resB] = await Promise.all([
      app
        .post(`/inquiries/${inquiryId}/reply`)
        .set('Authorization', bearerHeader(assistantWithPermToken))
        .send({
          body: 'رد الأسيستنت سارة',
          clientRequestId: 'reply-race-a',
        }),
      app
        .post(`/inquiries/${inquiryId}/reply`)
        .set('Authorization', bearerHeader(teacherToken))
        .send({
          body: 'رد المستر محمود في نفس اللحظة',
          clientRequestId: 'reply-race-b',
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? resA : resB;
    const loser = resA.status === 409 ? resA : resB;

    expect(loser.body.code).toBe('ALREADY_REPLIED');

    // Replay winner's request with identical clientRequestId -> 200 idempotent
    const winnerReqId = resA.status === 200 ? 'reply-race-a' : 'reply-race-b';
    const winnerToken = resA.status === 200 ? assistantWithPermToken : teacherToken;
    const replayRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(winnerToken))
      .send({
        body: winner.body.data.reply.body,
        clientRequestId: winnerReqId,
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.reply.clientRequestId).toBe(winnerReqId);
  });

  it('T9 (Optimistic Concurrency): rejects staff reply with 409 STALE_INQUIRY when expectedEditCount does not match after parent edits', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'ABSENCE_EXCUSE',
        body: 'نص قبل التعديل (editCount=0)',
        clientRequestId: 'req-t9',
      });
    const inquiryId = createRes.body.data._id;

    // Parent edits the inquiry -> editCount becomes 1
    const editRes = await app
      .patch(`/parent/inquiries/${inquiryId}`)
      .set('Authorization', bearerHeader(parentToken))
      .send({ body: 'نص جديد بعد التعديل (editCount=1)' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.editCount).toBe(1);

    // Staff tries to reply using stale expectedEditCount: 0
    const staleReplyRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({
        body: 'رد مبني على النص القديم',
        clientRequestId: 'rep-stale-1',
        expectedEditCount: 0,
      });

    expect(staleReplyRes.status).toBe(409);
    expect(staleReplyRes.body.code).toBe('STALE_INQUIRY');
    expect(staleReplyRes.body.data?.currentEditCount).toBe(1);
    expect(staleReplyRes.body.data?.currentBody).toBe('نص جديد بعد التعديل (editCount=1)');

    // Staff retries with updated expectedEditCount: 1 -> 200 OK
    const freshReplyRes = await app
      .post(`/inquiries/${inquiryId}/reply`)
      .set('Authorization', bearerHeader(assistantWithPermToken))
      .send({
        body: 'رد بعد قراءة النص المعدل',
        clientRequestId: 'rep-fresh-1',
        expectedEditCount: 1,
      });
    expect(freshReplyRes.status).toBe(200);
    expect(freshReplyRes.body.data.status).toBe('REPLIED');
  });

  it('T10 (Race Condition): concurrent parent cancellation and staff reply — exactly one wins (200) and the other gets 409 (INQUIRY_CANCELLED or ALREADY_REPLIED)', async () => {
    const createRes = await app
      .post('/parent/inquiries')
      .set('Authorization', bearerHeader(parentToken))
      .send({
        studentId: student1._id.toString(),
        category: 'GENERAL',
        body: 'سباق بين الإلغاء والرد',
        clientRequestId: 'req-t10',
      });
    const inquiryId = createRes.body.data._id;

    const [cancelRes, replyRes] = await Promise.all([
      app
        .post(`/parent/inquiries/${inquiryId}/cancel`)
        .set('Authorization', bearerHeader(parentToken)),
      app
        .post(`/inquiries/${inquiryId}/reply`)
        .set('Authorization', bearerHeader(assistantWithPermToken))
        .send({
          body: 'رد الأسيستنت المتزامن مع الإلغاء',
          clientRequestId: 'rep-race-cancel',
        }),
    ]);

    const statuses = [cancelRes.status, replyRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    if (cancelRes.status === 200) {
      expect(replyRes.status).toBe(409);
      expect(replyRes.body.code).toBe('INQUIRY_CANCELLED');
    } else {
      expect(replyRes.status).toBe(200);
      expect(cancelRes.status).toBe(409);
      expect(cancelRes.body.code).toBe('ALREADY_REPLIED');
    }

    const finalDoc = await ParentInquiryModel.findById(inquiryId).lean();
    expect(finalDoc?.isOpen).toBe(false);
    expect(['CANCELLED', 'REPLIED']).toContain(finalDoc?.status);
  });
});
