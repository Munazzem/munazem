import mongoose, { Schema, Model } from 'mongoose';
import { GradeLevel } from '../../common/enums/enum.service.js';
import type { ITeacherMessageDocument } from '../../types/teacher-message.types.js';

const teacherMessageSchema = new Schema<ITeacherMessageDocument>(
  {
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetType: {
      type: String,
      enum: ['GROUP', 'GRADE'],
      required: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'Group',
      default: undefined,
    },
    groupName: {
      type: String,
      trim: true,
      default: undefined,
    },
    gradeLevel: {
      type: String,
      enum: Object.values(GradeLevel),
      required: true,
    },
    title: {
      type: String,
      trim: true,
      default: undefined,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    clientRequestId: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['SENDING', 'SENT', 'FAILED'],
      default: 'SENDING',
      required: true,
    },
    targetStudentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    reachedParentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    pushSentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index 1: Fast retrieval of teacher's message history sorted by date
teacherMessageSchema.index({ teacherId: 1, createdAt: -1 });

// Index 2: Idempotency guarantee per teacher
teacherMessageSchema.index({ teacherId: 1, clientRequestId: 1 }, { unique: true });

export const TeacherMessageModel: Model<ITeacherMessageDocument> =
  mongoose.model<ITeacherMessageDocument>('TeacherMessage', teacherMessageSchema);
