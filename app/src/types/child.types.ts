export interface SubjectEnrollment {
  studentId: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  centerName?: string;
  groupId: string;
  groupName: string;
  schedule: Array<{ day: string; time: string }>;
  gradeLevel: string;
  studentCode?: string;
  barcode?: string;
  cardNumber?: string | null;
  qrValue?: string;
}

export interface ChildCardSummary {
  id: string; // Grouping ID or primary studentId
  studentName: string;
  gradeLevel: string;
  studentCode?: string;
  barcode?: string;
  cardNumber?: string | null;
  qrValue?: string;
  subjectsCount: number;
  subjects: Array<{
    studentId: string;
    teacherName: string;
    subject: string;
    centerName?: string;
    groupName?: string;
    studentCode?: string;
    barcode?: string;
  }>;
  latestAttendance?: {
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    subject: string;
    teacherName?: string;
  };
  attendanceRate: number; // e.g. 95%
  latestExam?: {
    title: string;
    score: number;
    totalMarks: number;
    date: string;
    subject: string;
    teacherName?: string;
  };
  financialSummary: {
    hasOutstandingDebt: boolean;
    remainingAmount: number;
    hasActiveSubscription: boolean;
  };
}

export interface StudentCardData {
  studentId: string;
  studentName: string;
  gradeLevel: string;
  studentCode: string;
  barcode: string;
  cardNumber?: string | null;
  qrValue: string;
  teacherName: string;
  subject: string;
  centerName?: string;
  groupName: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  subject: string;
  teacherName: string;
  groupName: string;
  notes?: string;
}

export interface ExamRecord {
  id: string;
  title: string;
  score: number;
  totalMarks: number;
  passingMarks: number;
  percentage: number;
  passed: boolean;
  date: string;
  subject: string;
  teacherName: string;
}

export interface FinancialRecord {
  cycleNumber: number;
  cycleCapacity: number;
  sessionsConsumed: number;
  fullCyclePrice: number;
  totalPaid: number;
  remainingAmount: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  subject: string;
  teacherName: string;
  payments: Array<{
    id: string;
    amount: number;
    date: string;
    description?: string;
  }>;
}

export interface FamilyOverviewData {
  parentName: string;
  todayFormatted: string;
  healthStatus: 'ALL_GOOD' | 'NEEDS_ATTENTION' | 'UPDATES_AVAILABLE' | 'NO_DATA';
  alertMessage?: string;
  totalChildren: number;
  totalOutstandingDebt: number;
  children: ChildCardSummary[];
}
