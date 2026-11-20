import { Document, Types } from 'mongoose';

export type InquiryStatus = 'PENDING' | 'ESCALATED' | 'REPLIED' | 'CANCELLED';
export type InquiryAssignee = 'ASSISTANT' | 'TEACHER';
export type InquiryCategory =
  | 'ABSENCE_EXCUSE'
  | 'FINANCIAL'
  | 'ACADEMIC_LEVEL'
  | 'GROUP_CHANGE'
  | 'GENERAL';
export type InquiryReplierRole = 'assistant' | 'teacher';

export const INQUIRY_CATEGORIES: readonly InquiryCategory[] = [
  'ABSENCE_EXCUSE',
  'FINANCIAL',
  'ACADEMIC_LEVEL',
  'GROUP_CHANGE',
  'GENERAL',
] as const;

export const INQUIRY_STATUSES: readonly InquiryStatus[] = [
  'PENDING',
  'ESCALATED',
  'REPLIED',
  'CANCELLED',
] as const;

export const INQUIRY_ASSIGNEES: readonly InquiryAssignee[] = [
  'ASSISTANT',
  'TEACHER',
] as const;

export const INQUIRY_REPLIER_ROLES: readonly InquiryReplierRole[] = [
  'assistant',
  'teacher',
] as const;

export const MAX_INQUIRY_EDITS = 3;
export const CANCELLED_INQUIRY_TTL_SECONDS = 2592000; // 30 days

export interface IInquiryReply {
  body: string;
  repliedBy: Types.ObjectId;
  repliedByRole: InquiryReplierRole;
  repliedByName: string;
  repliedAt: Date;
  clientRequestId: string;
}

export interface IParentInquiry {
  parentId: Types.ObjectId;
  studentId: Types.ObjectId;
  teacherId: Types.ObjectId;
  groupId?: Types.ObjectId | null | undefined;
  studentName?: string | undefined;
  groupName?: string | undefined;
  category: InquiryCategory;
  body: string;
  status: InquiryStatus;
  isOpen: boolean;
  assignedTo: InquiryAssignee;
  editCount: number;
  editedAt?: Date | null | undefined;
  escalatedAt?: Date | null | undefined;
  escalatedBy?: Types.ObjectId | null | undefined;
  escalationNote?: string | null | undefined;
  reply?: IInquiryReply | null | undefined;
  cancelledAt?: Date | null | undefined;
  clientRequestId: string;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
}

export interface IParentInquiryDocument extends IParentInquiry, Document {}
