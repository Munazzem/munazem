export type TeacherMessageTargetType = 'GROUP' | 'GRADE';
export type TeacherMessageStatus = 'SENDING' | 'SENT' | 'FAILED';

export interface TeacherMessage {
  _id: string;
  teacherId: string;
  sentBy: string;
  targetType: TeacherMessageTargetType;
  groupId?: string;
  groupName?: string;
  gradeLevel: string;
  title?: string;
  body: string;
  clientRequestId: string;
  status: TeacherMessageStatus;
  targetStudentCount: number;
  reachedParentCount: number;
  pushSentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherMessageAudience {
  targetStudentCount: number;
  reachedParentCount: number;
  studentsWithoutParentCount: number;
}

export interface CreateTeacherMessageDTO {
  targetType: TeacherMessageTargetType;
  groupId?: string;
  gradeLevel?: string;
  title?: string;
  body: string;
  clientRequestId: string;
}

export interface PaginatedTeacherMessagesResponse {
  messages: TeacherMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
