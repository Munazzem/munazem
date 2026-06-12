// ─── Shared job payload types for the WhatsApp queue ─────────────────────────
// All job variants share the base fields.  The `kind` discriminant lets the
// processor render the correct Arabic message without re-fetching the DB.
// `teacherId` identifies which teacher's WhatsApp client should send the message.

export type WhatsAppJobKind = 'session_absent' | 'exam_result' | 'payment_reminder';

/** Payload for a student who was absent from a session */
export interface SessionAbsentPayload {
    kind:        'session_absent';
    teacherId:   string;
    parentPhone: string;
    studentName: string;
    groupName:   string;
    sessionDate: string;   // ISO string — formatted inside the processor
    teacherName: string;
}

/** Payload for a student's exam result */
export interface ExamResultPayload {
    kind:        'exam_result';
    teacherId:   string;
    parentPhone: string;
    studentName: string;
    examTitle:   string;
    score:       number;
    totalMarks:  number;
    percentage:  number;
    grade:       string;   // A+, A, B … F
    passed:      boolean;
    examDate:    string;   // ISO string
}

/** Payload for a payment reminder sent to a parent */
export interface PaymentReminderPayload {
    kind:        'payment_reminder';
    teacherId:   string;
    parentPhone: string;
    studentName: string;
    gradeLevel:  string;
    teacherName: string;
}

export type WhatsAppJobData = SessionAbsentPayload | ExamResultPayload | PaymentReminderPayload;

// ─── Email job types ─────────────────────────────────────────────────────────
export type EmailJobKind = 'weekly_teacher_report';

export interface WeeklyTeacherReportPayload {
    kind:                 'weekly_teacher_report';
    teacherId:            string;
    teacherName:          string;
    teacherEmail:         string;
    weekStart:            string;
    weekEnd:              string;
    incomeSubscriptions:  number;
    incomeNotebooks:      number;
    incomeOther:          number;
    totalIncome:          number;
    expenseSalaries:      number;
    expenseRent:          number;
    expenseOther:         number;
    totalExpenses:        number;
    netBalance:           number;
    completedSessions:    number;
    cancelledSessions:    number;
    totalStudents:        number;
    unpaidStudents:       number;
}

export type EmailJobData = WeeklyTeacherReportPayload;
