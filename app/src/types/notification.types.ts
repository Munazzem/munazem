export type NotificationType =
  | 'ATTENDANCE_ABSENT'
  | 'ATTENDANCE_PRESENT'
  | 'EXAM_RESULT'
  | 'PAYMENT_RECORDED'
  | 'CYCLE_STARTED';

export type AttendanceNotificationKind =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'EXCUSED'
  | 'GUEST'
  | 'GUEST_COMPENSATED'
  | 'COMPENSATED_ADVANCE'
  | 'CORRECTION';

export type AttendanceNotificationStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceNotificationData {
  deepLink?: string;
  studentId?: string;
  sessionId?: string;
  tab?: string;
  kind?: AttendanceNotificationKind;
  status?: AttendanceNotificationStatus;
  scannedAt?: string | null;
  sessionDate?: string;
  startTime?: string | null;
  teacherName?: string;
  subject?: string;
  groupName?: string | null;
  isGuest?: boolean;
  isCorrection?: boolean;
  oldStatus?: AttendanceNotificationStatus;
  rev?: number;
  relatedGroupName?: string | null;
  relatedDate?: string | null;
  [key: string]: any;
}

export interface ParentNotificationItem {
  id: string;
  studentId: string;
  studentName?: string;
  teacherId: string;
  teacherName?: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: AttendanceNotificationData;
  isRead: boolean;
  createdAt: string;
}
