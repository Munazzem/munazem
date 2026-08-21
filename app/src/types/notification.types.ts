export type NotificationType =
  | 'ATTENDANCE_ABSENT'
  | 'ATTENDANCE_PRESENT'
  | 'EXAM_RESULT'
  | 'PAYMENT_RECORDED'
  | 'CYCLE_STARTED';

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
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}
