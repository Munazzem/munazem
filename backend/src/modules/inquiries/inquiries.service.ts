import mongoose from 'mongoose';
import { ParentInquiryModel } from '../../database/models/parent-inquiry.model.js';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { UserModel } from '../../database/models/user.model.js';
import { AttendanceModel } from '../../database/models/attendance.model.js';
import { ParentPushService } from '../parent/parent-push.service.js';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../../common/utils/response/error.responce.js';
import { UserRole } from '../../common/enums/enum.service.js';
import {
  MAX_INQUIRY_EDITS,
} from '../../types/parent-inquiry.types.js';
import type {
  InquiryCategory,
  InquiryReplierRole,
} from '../../types/parent-inquiry.types.js';

export interface CreateParentInquiryInput {
  studentId: string;
  category: InquiryCategory;
  body: string;
  clientRequestId: string;
}

export interface GetParentInquiriesQuery {
  studentId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface GetStaffInquiriesQuery {
  box?: 'assistant' | 'teacher' | 'all' | undefined;
  state?: 'open' | 'replied' | 'cancelled' | 'all' | undefined;
  category?: InquiryCategory | undefined;
  studentId?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface ReplyInquiryInput {
  tenantId: string;
  inquiryId: string;
  userId: string;
  userRole: string;
  body: string;
  clientRequestId: string;
  expectedEditCount?: number | undefined;
}

export interface EscalateInquiryInput {
  tenantId: string;
  inquiryId: string;
  userId: string;
  note?: string | undefined;
}

export class InquiriesService {
  // ── 1. Parent: Create Inquiry ─────────────────────────────────────────────
  static async createParentInquiry(
    parentId: string,
    input: CreateParentInquiryInput
  ): Promise<{ inquiry: any; isReplay: boolean }> {
    const parentObjId = new mongoose.Types.ObjectId(parentId);
    const studentObjId = new mongoose.Types.ObjectId(input.studentId);
    const cleanRequestId = input.clientRequestId.trim();
    const cleanBody = input.body.trim();

    // 1. Idempotency check on (parentId, clientRequestId)
    const existingByReqId = await ParentInquiryModel.findOne({
      parentId: parentObjId,
      clientRequestId: cleanRequestId,
    }).lean();

    if (existingByReqId) {
      return { inquiry: existingByReqId, isReplay: true };
    }

    // 2. Verify ACTIVE link between parent and student (Teacher mode only)
    const activeLink = await ParentStudentModel.findOne({
      parentId: parentObjId,
      studentId: studentObjId,
      status: 'ACTIVE',
    })
      .select('studentModelType centerId status')
      .lean();

    if (!activeLink) {
      throw ForbiddenException({
        message: 'الطالب غير مرتبط بحساب ولي الأمر أو تم إلغاء الارتباط',
        code: 'STUDENT_NOT_LINKED',
      });
    }

    if (
      activeLink.studentModelType === 'CenterStudent' ||
      activeLink.centerId != null
    ) {
      throw ForbiddenException({
        message: 'هذه الميزة متاحة لطلاب المعلمين المستقلين فقط',
        code: 'UNSUPPORTED_STUDENT',
      });
    }

    // 3. Verify student exists, is active, and is a teacher student (centerId: null)
    const student = await StudentModel.findById(studentObjId)
      .select('_id studentName teacherId groupId centerId isActive')
      .lean();

    if (
      !student ||
      student.isActive === false ||
      student.centerId != null ||
      !student.teacherId
    ) {
      throw ForbiddenException({
        message: 'الطالب غير نشط أو غير مدعوم في هذا النظام',
        code: 'UNSUPPORTED_STUDENT',
      });
    }

    const group = student.groupId
      ? await GroupModel.findById(student.groupId).select('name').lean()
      : null;

    // 4. Create document with atomic partial-unique & idempotency index protection
    try {
      const created = await ParentInquiryModel.create({
        parentId: parentObjId,
        studentId: student._id,
        teacherId: student.teacherId,
        groupId: student.groupId ?? null,
        studentName: (student.studentName || '').trim().slice(0, 120),
        groupName: ((group as any)?.name || '').trim().slice(0, 120),
        category: input.category,
        body: cleanBody,
        status: 'PENDING',
        isOpen: true,
        assignedTo: 'ASSISTANT',
        editCount: 0,
        clientRequestId: cleanRequestId,
      });

      return { inquiry: created.toObject(), isReplay: false };
    } catch (err: any) {
      if (err?.code === 11000) {
        // Check if collision was due to concurrent duplicate clientRequestId
        const replayDoc = await ParentInquiryModel.findOne({
          parentId: parentObjId,
          clientRequestId: cleanRequestId,
        }).lean();
        if (replayDoc) {
          return { inquiry: replayDoc, isReplay: true };
        }

        // Otherwise collision is on partial unique index { parentId, studentId, isOpen: true }
        const activeInquiry = await ParentInquiryModel.findOne({
          parentId: parentObjId,
          studentId: studentObjId,
          isOpen: true,
        })
          .select('_id status')
          .lean();

        throw ConflictException({
          message:
            'يوجد طلب نشط بالفعل لهذا الطالب، يرجى انتظار الرد قبل إرسال طلب جديد',
          code: 'ACTIVE_INQUIRY_EXISTS',
          data: {
            activeInquiryId: activeInquiry?._id?.toString() ?? null,
          },
        });
      }
      throw err;
    }
  }

  // ── 2. Parent: List Inquiries ─────────────────────────────────────────────
  static async getParentInquiries(
    parentId: string,
    query: GetParentInquiriesQuery
  ) {
    const parentObjId = new mongoose.Types.ObjectId(parentId);
    const filter: Record<string, any> = { parentId: parentObjId };
    if (query.studentId) {
      filter.studentId = new mongoose.Types.ObjectId(query.studentId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const activeFilter: Record<string, any> = {
      parentId: parentObjId,
      isOpen: true,
    };
    if (query.studentId) {
      activeFilter.studentId = new mongoose.Types.ObjectId(query.studentId);
    }

    const [inquiries, total, activeInquiry] = await Promise.all([
      ParentInquiryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ParentInquiryModel.countDocuments(filter),
      ParentInquiryModel.findOne(activeFilter).sort({ createdAt: -1 }).lean(),
    ]);

    return {
      inquiries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      activeInquiry: activeInquiry ?? null,
    };
  }

  // ── 3. Parent: Get Single Inquiry ─────────────────────────────────────────
  static async getParentInquiryById(parentId: string, inquiryId: string) {
    const inquiry = await ParentInquiryModel.findOne({
      _id: new mongoose.Types.ObjectId(inquiryId),
      parentId: new mongoose.Types.ObjectId(parentId),
    }).lean();

    if (!inquiry) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    return inquiry;
  }

  // ── 4. Parent: Edit Inquiry (Atomic Compare-And-Set) ──────────────────────
  static async updateParentInquiry(
    parentId: string,
    inquiryId: string,
    bodyText: string
  ) {
    const cleanBody = bodyText.trim();
    const parentObjId = new mongoose.Types.ObjectId(parentId);
    const inquiryObjId = new mongoose.Types.ObjectId(inquiryId);

    const updated = await ParentInquiryModel.findOneAndUpdate(
      {
        _id: inquiryObjId,
        parentId: parentObjId,
        status: 'PENDING',
        editCount: { $lt: MAX_INQUIRY_EDITS },
      },
      {
        $set: {
          body: cleanBody,
          editedAt: new Date(),
        },
        $inc: { editCount: 1 },
      },
      { returnDocument: 'after' }
    ).lean();

    if (updated) {
      return updated;
    }

    // Re-read to determine exact conflict reason
    const existing = await ParentInquiryModel.findOne({
      _id: inquiryObjId,
      parentId: parentObjId,
    })
      .select('status editCount')
      .lean();

    if (!existing) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    if (existing.status !== 'PENDING') {
      throw ConflictException({
        message: 'لا يمكن تعديل الطلب بعد تحويله أو الرد عليه أو إلغائه',
        code: 'NOT_EDITABLE',
        data: { status: existing.status },
      });
    }

    if (existing.editCount >= MAX_INQUIRY_EDITS) {
      throw ConflictException({
        message: 'لقد استنفدت الحد الأقصى المسموح به لتعديل الطلب (3 مرات)',
        code: 'EDIT_LIMIT_REACHED',
        data: { editCount: existing.editCount },
      });
    }

    throw ConflictException({
      message: 'تعذر تعديل الطلب في حالته الحالية',
      code: 'NOT_EDITABLE',
    });
  }

  // ── 5. Parent: Cancel Inquiry (Atomic Compare-And-Set) ────────────────────
  static async cancelParentInquiry(parentId: string, inquiryId: string) {
    const parentObjId = new mongoose.Types.ObjectId(parentId);
    const inquiryObjId = new mongoose.Types.ObjectId(inquiryId);
    const now = new Date();

    const cancelled = await ParentInquiryModel.findOneAndUpdate(
      {
        _id: inquiryObjId,
        parentId: parentObjId,
        status: 'PENDING',
      },
      {
        $set: {
          status: 'CANCELLED',
          isOpen: false,
          cancelledAt: now,
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (cancelled) {
      return cancelled;
    }

    const existing = await ParentInquiryModel.findOne({
      _id: inquiryObjId,
      parentId: parentObjId,
    })
      .select('status')
      .lean();

    if (!existing) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    if (existing.status === 'REPLIED') {
      throw ConflictException({
        message: 'تم الرد على الطلب بالفعل ولا يمكن إلغاؤه',
        code: 'ALREADY_REPLIED',
        data: { status: existing.status },
      });
    }

    if (existing.status === 'CANCELLED') {
      throw ConflictException({
        message: 'الطلب ملغى بالفعل',
        code: 'INQUIRY_CANCELLED',
        data: { status: existing.status },
      });
    }

    throw ConflictException({
      message: 'لا يمكن إلغاء الطلب بعد تحويله للمعلم أو الرد عليه',
      code: 'NOT_CANCELLABLE',
      data: { status: existing.status },
    });
  }

  // ── 6. Staff: List Inquiries ──────────────────────────────────────────────
  static async getStaffInquiries(
    tenantId: string,
    query: GetStaffInquiriesQuery
  ) {
    const filter: Record<string, any> = {
      teacherId: new mongoose.Types.ObjectId(tenantId),
    };

    const state = query.state || 'open';
    if (state === 'open') {
      filter.isOpen = true;
    } else if (state === 'replied') {
      filter.status = 'REPLIED';
    } else if (state === 'cancelled') {
      filter.status = 'CANCELLED';
    }

    const box = query.box || 'all';
    if (box === 'assistant') {
      filter.assignedTo = 'ASSISTANT';
    } else if (box === 'teacher') {
      filter.assignedTo = 'TEACHER';
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.studentId) {
      filter.studentId = new mongoose.Types.ObjectId(query.studentId);
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [inquiries, total] = await Promise.all([
      ParentInquiryModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ParentInquiryModel.countDocuments(filter),
    ]);

    return {
      inquiries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── 7. Staff: Covered Counts for Sidebar & Tabs ───────────────────────────
  static async getStaffInquiryCounts(tenantId: string) {
    const teacherObjId = new mongoose.Types.ObjectId(tenantId);

    const [assistantOpen, escalatedOpen] = await Promise.all([
      ParentInquiryModel.countDocuments({
        teacherId: teacherObjId,
        isOpen: true,
        assignedTo: 'ASSISTANT',
      }),
      ParentInquiryModel.countDocuments({
        teacherId: teacherObjId,
        isOpen: true,
        assignedTo: 'TEACHER',
      }),
    ]);

    return {
      assistantOpen,
      escalatedOpen,
      totalOpen: assistantOpen + escalatedOpen,
    };
  }

  // ── 8. Staff: Get Single Inquiry + Computed Student Context ───────────────
  static async getStaffInquiryById(tenantId: string, inquiryId: string) {
    const teacherObjId = new mongoose.Types.ObjectId(tenantId);
    const inquiry = await ParentInquiryModel.findOne({
      _id: new mongoose.Types.ObjectId(inquiryId),
      teacherId: teacherObjId,
    }).lean();

    if (!inquiry) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [student, attCounts] = await Promise.all([
      StudentModel.findOne({
        _id: inquiry.studentId,
        teacherId: teacherObjId,
      })
        .select(
          'studentName studentCode gradeLevel groupId totalDebt remainingSessions cycleNumber cycleCapacity consecutiveAbsences isActive'
        )
        .populate('groupId', 'name')
        .lean(),
      AttendanceModel.aggregate([
        {
          $match: {
            studentId: inquiry.studentId,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const countByStatus: Record<string, number> = {};
    for (const row of attCounts) {
      if (row?._id) {
        countByStatus[String(row._id)] = row.count || 0;
      }
    }

    const totalDebt = (student as any)?.totalDebt ?? 0;
    const studentContext = student
      ? {
          studentId: student._id.toString(),
          studentName: student.studentName,
          studentCode: student.studentCode || '',
          gradeLevel: student.gradeLevel,
          groupName: (student.groupId as any)?.name || inquiry.groupName || '',
          isActive: student.isActive,
          attendanceLast30Days: {
            present: countByStatus['PRESENT'] || 0,
            absent: countByStatus['ABSENT'] || 0,
            late: countByStatus['LATE'] || 0,
            excused: countByStatus['EXCUSED'] || 0,
            consecutiveAbsences: (student as any).consecutiveAbsences || 0,
          },
          financial: {
            totalDebt,
            hasOutstandingDebt: totalDebt > 0,
            remainingSessions: (student as any).remainingSessions ?? 0,
            cycleNumber: (student as any).cycleNumber ?? 0,
            cycleCapacity: (student as any).cycleCapacity ?? null,
          },
        }
      : null;

    return {
      inquiry,
      studentContext,
    };
  }

  // ── 9. Staff: Escalate Inquiry to Teacher (Atomic Compare-And-Set) ────────
  static async escalateInquiry(input: EscalateInquiryInput) {
    const teacherObjId = new mongoose.Types.ObjectId(input.tenantId);
    const inquiryObjId = new mongoose.Types.ObjectId(input.inquiryId);
    const cleanNote = input.note?.trim() || null;

    const updated = await ParentInquiryModel.findOneAndUpdate(
      {
        _id: inquiryObjId,
        teacherId: teacherObjId,
        status: 'PENDING',
        assignedTo: 'ASSISTANT',
      },
      {
        $set: {
          status: 'ESCALATED',
          isOpen: true,
          assignedTo: 'TEACHER',
          escalatedAt: new Date(),
          escalatedBy: new mongoose.Types.ObjectId(input.userId),
          escalationNote: cleanNote,
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (updated) {
      return updated;
    }

    const existing = await ParentInquiryModel.findOne({
      _id: inquiryObjId,
      teacherId: teacherObjId,
    })
      .select('status assignedTo')
      .lean();

    if (!existing) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    if (existing.status === 'REPLIED') {
      throw ConflictException({
        message: 'تم الرد على الطلب بالفعل ولا يمكن تحويله',
        code: 'ALREADY_REPLIED',
        data: { status: existing.status },
      });
    }

    if (existing.status === 'CANCELLED') {
      throw ConflictException({
        message: 'قام ولي الأمر بإلغاء هذا الطلب',
        code: 'INQUIRY_CANCELLED',
        data: { status: existing.status },
      });
    }

    throw ConflictException({
      message: 'الطلب محوّل للمعلم بالفعل أو غير قابل للتحويل',
      code: 'NOT_ESCALATABLE',
      data: { status: existing.status },
    });
  }

  // ── 10. Staff: Reply to Inquiry (Atomic Compare-And-Set + Optimistic Concurrency) ──
  static async replyToInquiry(
    input: ReplyInquiryInput
  ): Promise<{ inquiry: any; isReplay: boolean }> {
    const teacherObjId = new mongoose.Types.ObjectId(input.tenantId);
    const inquiryObjId = new mongoose.Types.ObjectId(input.inquiryId);
    const cleanBody = input.body.trim();
    const cleanReqId = input.clientRequestId.trim();
    const replierRole: InquiryReplierRole =
      input.userRole === UserRole.teacher ? 'teacher' : 'assistant';

    const replierUser = await UserModel.findById(input.userId)
      .select('name')
      .lean();
    const replierName = (
      replierUser?.name?.trim() ||
      (replierRole === 'teacher' ? 'المعلم' : 'المساعد')
    ).slice(0, 120);

    const atomicFilter: Record<string, any> = {
      _id: inquiryObjId,
      teacherId: teacherObjId,
      isOpen: true,
    };

    if (replierRole === 'assistant') {
      // Security A6: Assistant can only reply to PENDING inquiries assigned to ASSISTANT
      atomicFilter.status = 'PENDING';
      atomicFilter.assignedTo = 'ASSISTANT';
    } else {
      atomicFilter.status = { $in: ['PENDING', 'ESCALATED'] };
    }

    if (input.expectedEditCount !== undefined) {
      atomicFilter.editCount = input.expectedEditCount;
    }

    const now = new Date();
    const updated = await ParentInquiryModel.findOneAndUpdate(
      atomicFilter,
      {
        $set: {
          status: 'REPLIED',
          isOpen: false,
          reply: {
            body: cleanBody,
            repliedBy: new mongoose.Types.ObjectId(input.userId),
            repliedByRole: replierRole,
            repliedByName: replierName,
            repliedAt: now,
            clientRequestId: cleanReqId,
          },
        },
      },
      { returnDocument: 'after' }
    ).lean();

    if (updated) {
      ParentPushService.notifyInquiryReply(String(updated._id));
      return { inquiry: updated, isReplay: false };
    }

    // Re-read document scoped to tenant to determine exact failure cause
    const existing = await ParentInquiryModel.findOne({
      _id: inquiryObjId,
      teacherId: teacherObjId,
    }).lean();

    if (!existing) {
      throw NotFoundException({ message: 'الطلب غير موجود' });
    }

    // Idempotency S4: Same reply clientRequestId -> return 200 OK
    if (
      existing.status === 'REPLIED' &&
      existing.reply?.clientRequestId === cleanReqId
    ) {
      return { inquiry: existing, isReplay: true };
    }

    if (existing.status === 'REPLIED') {
      throw ConflictException({
        message: 'تم الرد على هذا الطلب بالفعل',
        code: 'ALREADY_REPLIED',
        data: {
          repliedByName: existing.reply?.repliedByName ?? null,
          repliedByRole: existing.reply?.repliedByRole ?? null,
        },
      });
    }

    if (existing.status === 'CANCELLED') {
      throw ConflictException({
        message: 'قام ولي الأمر بإلغاء هذا الطلب قبل إرسال الرد',
        code: 'INQUIRY_CANCELLED',
      });
    }

    if (
      replierRole === 'assistant' &&
      (existing.status === 'ESCALATED' || existing.assignedTo === 'TEACHER')
    ) {
      throw ForbiddenException({
        message: 'هذا الطلب محوّل للمعلم فقط ولا يمكن للمساعد الرد عليه',
        code: 'TEACHER_ONLY',
      });
    }

    if (
      input.expectedEditCount !== undefined &&
      existing.editCount !== input.expectedEditCount
    ) {
      throw ConflictException({
        message:
          'قام ولي الأمر بتعديل نص الطلب أثناء كتابة الرد، يرجى مراجعة النص الجديد',
        code: 'STALE_INQUIRY',
        data: {
          currentEditCount: existing.editCount,
          currentBody: existing.body,
          inquiry: existing,
        },
      });
    }

    throw ConflictException({
      message: 'تعذر الرد على الطلب في حالته الحالية',
      code: 'ALREADY_REPLIED',
    });
  }
}
