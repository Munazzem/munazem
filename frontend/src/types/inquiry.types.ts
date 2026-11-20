export type InquiryStatus = 'PENDING' | 'ESCALATED' | 'REPLIED' | 'CANCELLED';
export type InquiryAssignee = 'ASSISTANT' | 'TEACHER';
export type InquiryCategory =
  | 'ABSENCE_EXCUSE'
  | 'FINANCIAL'
  | 'ACADEMIC_LEVEL'
  | 'GROUP_CHANGE'
  | 'GENERAL';
export type InquiryReplierRole = 'assistant' | 'teacher';

export type InquiryBoxFilter = 'assistant' | 'teacher' | 'all';
export type InquiryStateFilter = 'open' | 'replied' | 'cancelled' | 'all';

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

export interface InquiryStudentContext {
  studentId: string;
  studentName: string;
  studentCode: string;
  gradeLevel: string;
  groupName: string;
  isActive: boolean;
  attendanceLast30Days: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    consecutiveAbsences: number;
  };
  financial: {
    totalDebt: number;
    hasOutstandingDebt: boolean;
    remainingSessions: number;
    cycleNumber: number;
    cycleCapacity: number | null;
  };
}

export interface InquiryDetailResponse {
  inquiry: ParentInquiry;
  studentContext: InquiryStudentContext | null;
}

export interface InquiryCountsResponse {
  assistantOpen: number;
  escalatedOpen: number;
  totalOpen: number;
}

export interface PaginatedInquiriesResponse {
  inquiries: ParentInquiry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReplyInquiryDTO {
  body: string;
  clientRequestId: string;
  expectedEditCount?: number;
}

export interface EscalateInquiryDTO {
  note?: string;
}

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  ABSENCE_EXCUSE: 'اعتذار عن غياب',
  FINANCIAL: 'استفسار مالي',
  ACADEMIC_LEVEL: 'مستوى الطالب / درجات',
  GROUP_CHANGE: 'طلب تغيير مجموعة',
  GENERAL: 'استفسار عام',
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  PENDING: 'في انتظار الرد',
  ESCALATED: 'محوّل للمستر',
  REPLIED: 'تم الرد',
  CANCELLED: 'ملغى من ولي الأمر',
};
