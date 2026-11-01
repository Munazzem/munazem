import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { TeacherMessageModel } from '../../src/database/models/teacher-message.model.js';
import { ParentNotificationModel } from '../../src/database/models/parent-notification.model.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';
import { ParentNotificationType } from '../../src/types/parent.types.js';

describe('Phase 1 Unit: TeacherMessage Model & Types', () => {
  it('should validate required fields properly on TeacherMessage', () => {
    const invalidDoc = new TeacherMessageModel({});
    const validationError = invalidDoc.validateSync();

    expect(validationError).toBeDefined();
    expect(validationError?.errors['teacherId']).toBeDefined();
    expect(validationError?.errors['sentBy']).toBeDefined();
    expect(validationError?.errors['targetType']).toBeDefined();
    expect(validationError?.errors['gradeLevel']).toBeDefined();
    expect(validationError?.errors['body']).toBeDefined();
    expect(validationError?.errors['clientRequestId']).toBeDefined();
  });

  it('should reject invalid targetType or status values', () => {
    const docWithBadEnums = new TeacherMessageModel({
      teacherId: new mongoose.Types.ObjectId(),
      sentBy: new mongoose.Types.ObjectId(),
      targetType: 'INVALID_TARGET' as any,
      gradeLevel: GradeLevel.SEC_1,
      body: 'مرحبا بكم',
      clientRequestId: 'req-1',
      status: 'PENDING' as any,
    });

    const validationError = docWithBadEnums.validateSync();
    expect(validationError).toBeDefined();
    expect(validationError?.errors['targetType']).toBeDefined();
    expect(validationError?.errors['status']).toBeDefined();
  });

  it('should apply default values correctly for valid doc', () => {
    const validDoc = new TeacherMessageModel({
      teacherId: new mongoose.Types.ObjectId(),
      sentBy: new mongoose.Types.ObjectId(),
      targetType: 'GRADE',
      gradeLevel: GradeLevel.SEC_1,
      body: 'رسالة تجريبية',
      clientRequestId: 'req-123',
    });

    expect(validDoc.status).toBe('SENDING');
    expect(validDoc.targetStudentCount).toBe(0);
    expect(validDoc.reachedParentCount).toBe(0);
    expect(validDoc.pushSentCount).toBe(0);
    expect(validDoc.validateSync()).toBeUndefined();
  });

  it('should confirm schema has the expected indexes configured', () => {
    const indexes = TeacherMessageModel.schema.indexes();
    
    // Check history index { teacherId: 1, createdAt: -1 }
    const hasHistoryIndex = indexes.some(
      ([fields]) => fields.teacherId === 1 && fields.createdAt === -1
    );
    expect(hasHistoryIndex).toBe(true);

    // Check unique idempotency index { teacherId: 1, clientRequestId: 1 }
    const idempotencyIndex = indexes.find(
      ([fields]) => fields.teacherId === 1 && fields.clientRequestId === 1
    );
    expect(idempotencyIndex).toBeDefined();
    expect(idempotencyIndex?.[1]?.unique).toBe(true);
  });

  it('should accept TEACHER_MESSAGE in ParentNotificationModel schema validation', () => {
    const notificationDoc = new ParentNotificationModel({
      parentId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      teacherId: new mongoose.Types.ObjectId(),
      type: ParentNotificationType.TEACHER_MESSAGE,
      title: 'رسالة من المدرس',
      body: 'نص الإشعار',
      deepLink: 'monazem://notifications',
      eventId: 'teacher_message:507f1f77bcf86cd799439011',
    });

    const error = notificationDoc.validateSync();
    expect(error).toBeUndefined();
    expect(notificationDoc.type).toBe('TEACHER_MESSAGE');
  });
});
