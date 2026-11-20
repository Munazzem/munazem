import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { ParentInquiryModel } from '../../src/database/models/parent-inquiry.model.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { ParentNotificationType } from '../../src/types/parent.types.js';
import { UserRole } from '../../src/common/enums/enum.service.js';
import { userCreationSchema, userUpdateSchema } from '../../src/validation/user.validation.js';
import { CANCELLED_INQUIRY_TTL_SECONDS } from '../../src/types/parent-inquiry.types.js';

describe('Phase 1 Unit: ParentInquiry Model, Indexes, Hooks & RBAC', () => {
  beforeEach(async () => {
    await ParentInquiryModel.deleteMany({});
    await ParentInquiryModel.createIndexes();
  });

  it('1. should reject a second active inquiry (PENDING or ESCALATED) for the same (parentId, studentId) with E11000', async () => {
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const teacherId = new mongoose.Types.ObjectId();

    const first = await ParentInquiryModel.create({
      parentId,
      studentId,
      teacherId,
      category: 'FINANCIAL',
      body: 'استفسار عن اشتراك الشهر الحالي',
      clientRequestId: 'req-active-1',
    });

    expect(first.status).toBe('PENDING');
    expect(first.isOpen).toBe(true);
    expect(first.assignedTo).toBe('ASSISTANT');
    expect(first.cancelledAt).toBeNull();

    // Attempt second PENDING inquiry for same (parentId, studentId)
    await expect(
      ParentInquiryModel.create({
        parentId,
        studentId,
        teacherId,
        category: 'GENERAL',
        body: 'استفسار ثانٍ لنفس الطالب قبل الرد',
        clientRequestId: 'req-active-2',
      })
    ).rejects.toMatchObject({ code: 11000 });

    // Escalate first inquiry — still open, so second inquiry must still be rejected
    const escalated = await ParentInquiryModel.findOneAndUpdate(
      { _id: first._id },
      { $set: { status: 'ESCALATED', assignedTo: 'TEACHER' } },
      { returnDocument: 'after' }
    );
    expect(escalated?.status).toBe('ESCALATED');
    expect(escalated?.isOpen).toBe(true);

    await expect(
      ParentInquiryModel.create({
        parentId,
        studentId,
        teacherId,
        category: 'GENERAL',
        body: 'محاولة أثناء التصعيد للمستر',
        clientRequestId: 'req-active-3',
      })
    ).rejects.toMatchObject({ code: 11000 });

    // Parallel active inquiry for a different child of the same parent must succeed
    const secondChildInquiry = await ParentInquiryModel.create({
      parentId,
      studentId: new mongoose.Types.ObjectId(),
      teacherId,
      category: 'ABSENCE_EXCUSE',
      body: 'اعتذار عن غياب الابن الثاني',
      clientRequestId: 'req-child-2',
    });
    expect(secondChildInquiry.isOpen).toBe(true);
  });

  it('2. should automatically sync isOpen=false via hooks when transitioning to REPLIED or CANCELLED and allow a new inquiry', async () => {
    const parentId = new mongoose.Types.ObjectId();
    const studentId = new mongoose.Types.ObjectId();
    const teacherId = new mongoose.Types.ObjectId();

    // Create initial inquiry
    const inquiry1 = await ParentInquiryModel.create({
      parentId,
      studentId,
      teacherId,
      category: 'ACADEMIC_LEVEL',
      body: 'ما مستوى الطالب في الامتحان الأخير؟',
      clientRequestId: 'req-cycle-1',
    });
    expect(inquiry1.isOpen).toBe(true);

    // Transition to REPLIED via findOneAndUpdate without passing isOpen explicitly
    const replied = await ParentInquiryModel.findOneAndUpdate(
      { _id: inquiry1._id, isOpen: true },
      {
        $set: {
          status: 'REPLIED',
          reply: {
            body: 'مستوى ممتاز وحصل على 19 من 20',
            repliedBy: teacherId,
            repliedByRole: 'teacher',
            repliedByName: 'أ/ أحمد',
            repliedAt: new Date(),
            clientRequestId: 'reply-req-1',
          },
        },
      },
      { returnDocument: 'after' }
    );

    expect(replied?.status).toBe('REPLIED');
    expect(replied?.isOpen).toBe(false);

    // Now parent can open a new inquiry for the same student
    const inquiry2 = await ParentInquiryModel.create({
      parentId,
      studentId,
      teacherId,
      category: 'GROUP_CHANGE',
      body: 'طلب نقل لمجموعة يوم الثلاثاء',
      clientRequestId: 'req-cycle-2',
    });
    expect(inquiry2.isOpen).toBe(true);

    // Transition inquiry2 to CANCELLED via document .save()
    inquiry2.status = 'CANCELLED';
    inquiry2.cancelledAt = new Date();
    // Even if someone left isOpen=true on the instance, pre('save') hook must force isOpen=false
    inquiry2.isOpen = true;
    await inquiry2.save();

    expect(inquiry2.isOpen).toBe(false);

    // Parent can open a third inquiry after CANCELLED
    const inquiry3 = await ParentInquiryModel.create({
      parentId,
      studentId,
      teacherId,
      category: 'GENERAL',
      body: 'استفسار جديد بعد الإلغاء',
      clientRequestId: 'req-cycle-3',
    });
    expect(inquiry3.isOpen).toBe(true);
  });

  it('3. should enforce idempotency index { parentId: 1, clientRequestId: 1 }', async () => {
    const parentId = new mongoose.Types.ObjectId();
    const teacherId = new mongoose.Types.ObjectId();

    await ParentInquiryModel.create({
      parentId,
      studentId: new mongoose.Types.ObjectId(),
      teacherId,
      category: 'GENERAL',
      body: 'الرسالة الأولى',
      clientRequestId: 'dup-client-req-1',
    });

    // Same parentId + same clientRequestId (even for a different studentId) must fail with E11000
    await expect(
      ParentInquiryModel.create({
        parentId,
        studentId: new mongoose.Types.ObjectId(),
        teacherId,
        category: 'GENERAL',
        body: 'رسالة مكررة بنفس المعرف',
        clientRequestId: 'dup-client-req-1',
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('4. should enforce maxlength and editCount constraints', () => {
    const overLimitDoc = new ParentInquiryModel({
      parentId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      teacherId: new mongoose.Types.ObjectId(),
      studentName: 'أ'.repeat(121),
      groupName: 'م'.repeat(121),
      category: 'GENERAL',
      body: 'ب'.repeat(1001),
      editCount: 4,
      escalationNote: 'ص'.repeat(301),
      clientRequestId: 'c'.repeat(65),
      reply: {
        body: 'ر'.repeat(2001),
        repliedBy: new mongoose.Types.ObjectId(),
        repliedByRole: 'assistant',
        repliedByName: 'س'.repeat(121),
        repliedAt: new Date(),
        clientRequestId: 'r'.repeat(65),
      },
    });

    const err = overLimitDoc.validateSync();
    expect(err).toBeDefined();
    expect(err?.errors['body']).toBeDefined();
    expect(err?.errors['studentName']).toBeDefined();
    expect(err?.errors['groupName']).toBeDefined();
    expect(err?.errors['editCount']).toBeDefined();
    expect(err?.errors['escalationNote']).toBeDefined();
    expect(err?.errors['clientRequestId']).toBeDefined();
    expect(err?.errors['reply.body']).toBeDefined();
    expect(err?.errors['reply.repliedByName']).toBeDefined();
    expect(err?.errors['reply.clientRequestId']).toBeDefined();
  });

  it('5. should configure TTL index on cancelledAt with partialFilterExpression { status: "CANCELLED" }', () => {
    const indexes = ParentInquiryModel.schema.indexes();

    const ttlIndex = indexes.find(([fields]) => fields.cancelledAt === 1);
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex?.[1]?.expireAfterSeconds).toBe(CANCELLED_INQUIRY_TTL_SECONDS);
    expect(ttlIndex?.[1]?.partialFilterExpression).toEqual({ status: 'CANCELLED' });

    const activePartialUniqueIndex = indexes.find(
      ([fields, opts]) => fields.parentId === 1 && fields.studentId === 1 && opts?.unique === true
    );
    expect(activePartialUniqueIndex).toBeDefined();
    expect(activePartialUniqueIndex?.[1]?.partialFilterExpression).toEqual({ isOpen: true });
  });

  it('6. should default canManageInquiries to false in UserModel and preserve it in Zod validation without stripping', () => {
    const assistantDoc = new UserModel({
      name: 'مساعد تجريبي',
      phone: '01012345678',
      password: 'password123',
      role: UserRole.assistant,
      teacherId: new mongoose.Types.ObjectId(),
    });

    expect(assistantDoc.assistantPermissions?.canManageInquiries).toBe(false);
    expect(assistantDoc.assistantPermissions?.canTakeAttendance).toBe(true);

    // Verify Zod schemas do not strip canManageInquiries
    const parsedCreate = userCreationSchema.parse({
      body: {
        name: 'مساعد جديد',
        phone: '01099998888',
        password: 'password123',
        assistantPermissions: {
          canManageInquiries: true,
        },
      },
    });
    expect(parsedCreate.body.assistantPermissions?.canManageInquiries).toBe(true);

    const parsedUpdate = userUpdateSchema.parse({
      body: {
        assistantPermissions: {
          canManageInquiries: false,
        },
      },
    });
    expect(parsedUpdate.body.assistantPermissions?.canManageInquiries).toBe(false);
  });

  it('7. should accept INQUIRY_REPLY in ParentNotificationModel schema validation', () => {
    const notificationDoc = new ParentNotificationModel({
      parentId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      teacherId: new mongoose.Types.ObjectId(),
      type: ParentNotificationType.INQUIRY_REPLY,
      title: 'رد على استفسارك — أحمد',
      body: 'تم قبول الاعتذار',
      deepLink: 'monazem://notifications',
      data: {
        inquiryId: new mongoose.Types.ObjectId().toString(),
        category: 'ABSENCE_EXCUSE',
        repliedByRole: 'assistant',
      },
      eventId: 'inquiry_reply:507f1f77bcf86cd799439011',
    });

    const error = notificationDoc.validateSync();
    expect(error).toBeUndefined();
    expect(notificationDoc.type).toBe('INQUIRY_REPLY');
    expect(notificationDoc.data?.kind).toBeUndefined();
  });
});
