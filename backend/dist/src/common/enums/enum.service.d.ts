export declare enum UserRole {
    superAdmin = "superAdmin",
    teacher = "teacher",
    assistant = "assistant"
}
export declare enum SubscriptionStatus {
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    PENDING = "PENDING"
}
export declare enum SubscriptionPlan {
    MINI = "MINI",
    BASIC = "BASIC",
    PREMIUM = "PREMIUM"
}
export declare const PLAN_PRICES: Record<SubscriptionPlan, number>;
export declare const PLAN_CONFIG: Record<SubscriptionPlan, {
    baseStudents: number;
    extraPricePer100: number;
}>;
export declare const DURATION_MONTHS: readonly [1, 4, 9, 12];
export type DurationMonths = number;
export declare const DURATION_LABELS: Record<DurationMonths, string>;
export declare enum GradeLevel {
    PREP_1 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A",
    PREP_2 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A",
    PREP_3 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A",
    SEC_1 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u062B\u0627\u0646\u0648\u064A",
    SEC_2 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u062B\u0627\u0646\u0648\u064A",
    SEC_3 = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u062B\u0627\u0646\u0648\u064A"
}
export declare const GRADE_LETTER: Record<GradeLevel, string>;
export declare enum TeacherStage {
    PREPARATORY = "PREPARATORY",
    SECONDARY = "SECONDARY"
}
export declare const STAGE_GRADES: Record<TeacherStage, GradeLevel[]>;
export declare enum SessionStatus {
    SCHEDULED = "SCHEDULED",
    IN_PROGRESS = "IN_PROGRESS",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED"
}
export declare enum AttendanceStatus {
    PRESENT = "PRESENT",
    ABSENT = "ABSENT",
    LATE = "LATE",
    EXCUSED = "EXCUSED"
}
export declare enum TransactionType {
    INCOME = "INCOME",
    EXPENSE = "EXPENSE"
}
export declare enum TransactionCategory {
    SUBSCRIPTION = "SUBSCRIPTION",
    NOTEBOOK_SALE = "NOTEBOOK_SALE",
    NOTEBOOK_RESERVATION = "NOTEBOOK_RESERVATION",
    NOTEBOOK_DELIVERY = "NOTEBOOK_DELIVERY",
    OTHER_INCOME = "OTHER_INCOME",
    SALARY = "SALARY",
    RENT = "RENT",
    SUPPLIES = "SUPPLIES",
    OTHER_EXPENSE = "OTHER_EXPENSE"
}
export declare enum QuestionType {
    MCQ = "MCQ",
    TRUE_FALSE = "TRUE_FALSE",
    ESSAY = "ESSAY"
}
export declare enum ExamStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    COMPLETED = "COMPLETED"
}
export declare enum ExamSource {
    MANUAL = "MANUAL",
    AI_GENERATED = "AI_GENERATED"
}
//# sourceMappingURL=enum.service.d.ts.map