import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export type TeacherMessageTargetType = 'GROUP' | 'GRADE';
export type TeacherMessageStatus = 'SENDING' | 'SENT' | 'FAILED';

export interface ITeacherMessage {
  teacherId: Types.ObjectId;
  sentBy: Types.ObjectId;
  targetType: TeacherMessageTargetType;
  groupId?: Types.ObjectId | null | undefined;
  groupName?: string | null | undefined;
  gradeLevel: GradeLevel;
  title?: string | null | undefined;
  body: string;
  clientRequestId: string;
  status: TeacherMessageStatus;
  targetStudentCount: number;
  reachedParentCount: number;
  pushSentCount: number;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface ITeacherMessageDocument extends ITeacherMessage, Document {}
