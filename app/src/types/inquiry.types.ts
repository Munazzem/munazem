export type InquiryStatus = 'PENDING' | 'ESCALATED' | 'REPLIED' | 'CANCELLED';
export type InquiryAssignee = 'ASSISTANT' | 'TEACHER';
export type InquiryCategory =
  | 'ABSENCE_EXCUSE'
  | 'FINANCIAL'
  | 'ACADEMIC_LEVEL'
  | 'GROUP_CHANGE'
  | 'GENERAL';
export type InquiryReplierRole = 'assistant' | 'teacher';

export const MAX_INQUIRY_EDITS = 3;
export const MAX_INQUIRY_BODY_LENGTH = 1000;

export interface InquiryReply {
  body: string;
  repliedBy: string;
  repliedByRole: InquiryReplierRole;
  repliedByName: string;
  repliedAt: string;
  clientRequestId: string;
}

export interface ParentInquiry {
  _id: string;
  parentId: string;
  studentId: string;
  teacherId: string;
  groupId?: string | null;
  studentName?: string;
  groupName?: string;
  category: InquiryCategory;
  body: string;
  status: InquiryStatus;
  isOpen: boolean;
  assignedTo: InquiryAssignee;
  editCount: number;
  editedAt?: string | null;
  escalatedAt?: string | null;
  escalatedBy?: string | null;
  escalationNote?: string | null;
  reply?: InquiryReply | null;
  cancelledAt?: string | null;
  clientRequestId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedParentInquiriesResponse {
  inquiries: ParentInquiry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeInquiry: ParentInquiry | null;
}

export interface CreateParentInquiryDTO {
  studentId: string;
  category: InquiryCategory;
  body: string;
  clientRequestId: string;
}

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  ABSENCE_EXCUSE: 'اعتذار عن غياب',
  FINANCIAL: 'استفسار مالي',
  ACADEMIC_LEVEL: 'مستوى الطالب / درجات',
  GROUP_CHANGE: 'تغيير مجموعة',
  GENERAL: 'استفسار عام',
};

export const INQUIRY_CATEGORY_OPTIONS: Array<{
  value: InquiryCategory;
  label: string;
}> = [
  { value: 'ABSENCE_EXCUSE', label: INQUIRY_CATEGORY_LABELS.ABSENCE_EXCUSE },
  { value: 'FINANCIAL', label: INQUIRY_CATEGORY_LABELS.FINANCIAL },
  { value: 'ACADEMIC_LEVEL', label: INQUIRY_CATEGORY_LABELS.ACADEMIC_LEVEL },
  { value: 'GROUP_CHANGE', label: INQUIRY_CATEGORY_LABELS.GROUP_CHANGE },
  { value: 'GENERAL', label: INQUIRY_CATEGORY_LABELS.GENERAL },
];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  PENDING: 'قيد الانتظار',
  ESCALATED: 'محوّل للمستر',
  REPLIED: 'تم الرد',
  CANCELLED: 'ملغي',
};
