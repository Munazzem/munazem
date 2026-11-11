import mongoose from 'mongoose';
import { TeacherMessageModel } from '../../database/models/teacher-message.model.js';
import { StudentModel } from '../../database/models/student.model.js';
import { GroupModel } from '../../database/models/group.model.js';
import { ParentStudentModel } from '../../database/models/parent-student.model.js';
import { ParentPushService } from '../parent/parent-push.service.js';
import {
  BadRequestException,
  NotFoundException,
} from '../../common/utils/response/error.responce.js';
import { GradeLevel } from '../../common/enums/enum.service.js';
import type { TeacherMessageTargetType } from '../../types/teacher-message.types.js';

export interface CreateTeacherMessageInput {
  targetType: TeacherMessageTargetType;
  groupId?: string;
  gradeLevel?: GradeLevel;
  title?: string;
  body: string;
  clientRequestId: string;
}

export interface GetAudienceInput {
  targetType: TeacherMessageTargetType;
  groupId?: string;
  gradeLevel?: GradeLevel;
}

export interface GetTeacherMessagesQuery {
  page?: number;
  limit?: number;
}

export class TeacherMessagesService {
  /**
   * Preview audience numbers before sending
   */
  static async getAudience(teacherId: string, input: GetAudienceInput) {
    const studentQuery: any = {
      teacherId: new mongoose.Types.ObjectId(teacherId),
      isActive: true,
      centerId: null,
    };

    if (input.targetType === 'GROUP') {
      if (!input.groupId) {
        throw BadRequestException({ message: 'معرف المجموعة مطلوب' });
      }
      const group = await GroupModel.findOne({
        _id: input.groupId,
        teacherId,
        isActive: true,
      }).lean();

      if (!group) {
        throw NotFoundException({ message: 'المجموعة غير موجودة أو غير تابعة للمدرس' });
      }
      studentQuery.groupId = group._id;
    } else {
      if (!input.gradeLevel) {
        throw BadRequestException({ message: 'المرحلة الدراسية مطلوبة' });
      }
      studentQuery.gradeLevel = input.gradeLevel;
    }

    const students = await StudentModel.find(studentQuery)
      .select('_id')
      .lean();

    const targetStudentCount = students.length;
    if (targetStudentCount === 0) {
      return {
        targetStudentCount: 0,
        reachedParentCount: 0,
        studentsWithoutParentCount: 0,
      };
    }

    const studentIds = students.map((s) => s._id);
    const activeLinks = await ParentStudentModel.find({
      studentId: { $in: studentIds },
      status: 'ACTIVE',
      studentModelType: 'Student',
    })
      .select('studentId parentId')
      .lean();

    const reachedParentCount = new Set(
      activeLinks.map((l) => l.parentId.toString())
    ).size;
    const studentsWithParentCount = new Set(
      activeLinks.map((l) => l.studentId.toString())
    ).size;
    const studentsWithoutParentCount = Math.max(
      0,
      targetStudentCount - studentsWithParentCount
    );

    return {
      targetStudentCount,
      reachedParentCount,
      studentsWithoutParentCount,
    };
  }

  /**
   * Create and trigger broadcast message to parents
   */
  static async createTeacherMessage(
    teacherId: string,
    sentBy: string,
    input: CreateTeacherMessageInput
  ) {
    const cleanRequestId = input.clientRequestId.trim();

    // 1. Idempotency Check: return existing message if already submitted
    const existing = await TeacherMessageModel.findOne({
      teacherId,
      clientRequestId: cleanRequestId,
    });

    if (existing) {
      // Mark as FAILED if stuck in SENDING for > 5 minutes
      const createdAtMs = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
      if (
        existing.status === 'SENDING' &&
        createdAtMs > 0 &&
        Date.now() - createdAtMs > 5 * 60 * 1000
      ) {
        existing.status = 'FAILED';
        await existing.save();
      }
      return existing;
    }

    // 2. Validate Scope & Snapshot Group/Grade Data
    let groupName: string | undefined;
    let gradeLevel: GradeLevel;
    const studentQuery: any = {
      teacherId: new mongoose.Types.ObjectId(teacherId),
      isActive: true,
      centerId: null,
    };

    if (input.targetType === 'GROUP') {
      if (!input.groupId) {
        throw BadRequestException({ message: 'معرف المجموعة مطلوب' });
      }
      const group = await GroupModel.findOne({
        _id: input.groupId,
        teacherId,
        isActive: true,
      });

      if (!group) {
        throw NotFoundException({ message: 'المجموعة غير موجودة أو غير تابعة للمدرس' });
      }

      groupName = group.name;
      gradeLevel = group.gradeLevel;
      studentQuery.groupId = group._id;
    } else {
      if (!input.gradeLevel) {
        throw BadRequestException({ message: 'المرحلة الدراسية مطلوبة' });
      }
      gradeLevel = input.gradeLevel;
      studentQuery.gradeLevel = gradeLevel;

      const hasStudents = await StudentModel.exists(studentQuery);
      if (!hasStudents) {
        throw BadRequestException({
          message: 'لا يوجد طلاب نشطين للمدرس في هذه المرحلة الدراسية',
        });
      }
    }

    // 3. Count target students & enforce 2000 max limit
    const students = await StudentModel.find(studentQuery)
      .select('_id')
      .lean();

    const targetStudentCount = students.length;
    if (targetStudentCount === 0) {
      throw BadRequestException({
        message: 'لا يوجد طلاب نشطين في نطاق الاستهداف المحدد',
      });
    }

    if (targetStudentCount > 2000) {
      throw BadRequestException({
        message: 'الحد الأقصى للطلاب المستهدفين في الرسالة الواحدة هو 2000 طالب',
      });
    }

    // 4. Calculate reachedParentCount & Enforce Zero-Audience Prevention (Requirement 1)
    const studentIds = students.map((s) => s._id);
    const activeLinks = await ParentStudentModel.find({
      studentId: { $in: studentIds },
      status: 'ACTIVE',
      studentModelType: 'Student',
    })
      .select('parentId')
      .lean();

    const reachedParentCount = new Set(
      activeLinks.map((l) => l.parentId.toString())
    ).size;

    if (reachedParentCount === 0) {
      throw BadRequestException({
        message: 'لا يمكن إرسال الرسالة: لا يوجد أولياء أمور مربوطين بالطلاب المستهدفين',
      });
    }

    // 5. Create TeacherMessage document with status SENDING
    try {
      const docData: any = {
        teacherId: new mongoose.Types.ObjectId(teacherId),
        sentBy: new mongoose.Types.ObjectId(sentBy),
        targetType: input.targetType,
        gradeLevel,
        body: input.body.trim(),
        clientRequestId: cleanRequestId,
        status: 'SENDING',
        targetStudentCount,
        reachedParentCount,
        pushSentCount: 0,
      };

      if (input.groupId) {
        docData.groupId = new mongoose.Types.ObjectId(input.groupId);
      }
      if (groupName) {
        docData.groupName = groupName;
      }
      if (input.title?.trim()) {
        docData.title = input.title.trim();
      }

      const message = await TeacherMessageModel.create(docData);

      // 6. Trigger background async dispatch (fire-and-forget)
      ParentPushService.notifyTeacherMessage(String((message as any)._id));

      return message;
    } catch (err: any) {
      // Race-condition fallback on unique index { teacherId, clientRequestId }
      if (err.code === 11000) {
        const raceExisting = await TeacherMessageModel.findOne({
          teacherId,
          clientRequestId: cleanRequestId,
        });
        if (raceExisting) return raceExisting;
      }
      throw err;
    }
  }

  /**
   * Fetch paginated teacher message history
   */
  static async getTeacherMessages(
    teacherId: string,
    query: GetTeacherMessagesQuery
  ) {
    // Auto-fail messages stuck in SENDING for > 5 minutes (Requirement 3)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await TeacherMessageModel.updateMany(
      {
        teacherId: new mongoose.Types.ObjectId(teacherId),
        status: 'SENDING',
        createdAt: { $lt: fiveMinutesAgo },
      },
      {
        $set: { status: 'FAILED' },
      }
    );

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      TeacherMessageModel.find({
        teacherId: new mongoose.Types.ObjectId(teacherId),
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TeacherMessageModel.countDocuments({
        teacherId: new mongoose.Types.ObjectId(teacherId),
      }),
    ]);

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
