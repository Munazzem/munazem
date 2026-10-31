import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export type TeacherMessageTargetType = 'GROUP' | 'GRADE';
export type TeacherMessageStatus = 'SENDING' | 'SENT' | 'FAILED';

export interface ITeacherMessage {
  teacherId: Types.ObjectId;
  sentBy: Types.ObjectId;
  targetType: TeacherMessageTargetType;
  groupId?: Types.ObjectId;
  groupName?: string;
  gradeLevel: GradeLevel;
  title?: string;
  body: string;
  clientRequestId: string;
  status: TeacherMessageStatus;
  targetStudentCount: number;
  reachedParentCount: number;
  pushSentCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITeacherMessageDocument extends ITeacherMessage, Document {}
