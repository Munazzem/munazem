export var UserRole;
(function (UserRole) {
    UserRole["superAdmin"] = "superAdmin";
    UserRole["teacher"] = "teacher";
    UserRole["assistant"] = "assistant";
})(UserRole || (UserRole = {}));
export var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["PENDING"] = "PENDING";
})(SubscriptionStatus || (SubscriptionStatus = {}));
export var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["MINI"] = "MINI";
    SubscriptionPlan["BASIC"] = "BASIC";
    SubscriptionPlan["PREMIUM"] = "PREMIUM";
})(SubscriptionPlan || (SubscriptionPlan = {}));
export const PLAN_PRICES = {
    [SubscriptionPlan.MINI]: 500,
    [SubscriptionPlan.BASIC]: 900,
    [SubscriptionPlan.PREMIUM]: 1200,
};
// Configuration for dynamic student-based pricing
export const PLAN_CONFIG = {
    [SubscriptionPlan.MINI]: { baseStudents: 250, extraPricePer100: 250 },
    [SubscriptionPlan.BASIC]: { baseStudents: 500, extraPricePer100: 200 },
    [SubscriptionPlan.PREMIUM]: { baseStudents: 500, extraPricePer100: 200 },
};
export const DURATION_MONTHS = [1, 4, 9, 12];
export const DURATION_LABELS = {
    1: 'شهر واحد',
    4: 'ترم دراسي (4 أشهر)',
    9: 'ترمين دراسيين (9 أشهر)',
    12: 'سنة كاملة (12 شهر)',
};
export var GradeLevel;
(function (GradeLevel) {
    // إعدادي
    GradeLevel["PREP_1"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A";
    GradeLevel["PREP_2"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A";
    GradeLevel["PREP_3"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u064A";
    // ثانوي
    GradeLevel["SEC_1"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u0623\u0648\u0644 \u0627\u0644\u062B\u0627\u0646\u0648\u064A";
    GradeLevel["SEC_2"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0646\u064A \u0627\u0644\u062B\u0627\u0646\u0648\u064A";
    GradeLevel["SEC_3"] = "\u0627\u0644\u0635\u0641 \u0627\u0644\u062B\u0627\u0644\u062B \u0627\u0644\u062B\u0627\u0646\u0648\u064A";
})(GradeLevel || (GradeLevel = {}));
// Letter code per grade — used in student auto-generated code (e.g. 5A, 12C)
export const GRADE_LETTER = {
    [GradeLevel.PREP_1]: 'A',
    [GradeLevel.PREP_2]: 'B',
    [GradeLevel.PREP_3]: 'C',
    [GradeLevel.SEC_1]: 'D',
    [GradeLevel.SEC_2]: 'E',
    [GradeLevel.SEC_3]: 'F',
};
// Grades visible per teacher stage
export var TeacherStage;
(function (TeacherStage) {
    TeacherStage["PREPARATORY"] = "PREPARATORY";
    TeacherStage["SECONDARY"] = "SECONDARY";
})(TeacherStage || (TeacherStage = {}));
export const STAGE_GRADES = {
    [TeacherStage.PREPARATORY]: [GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3],
    [TeacherStage.SECONDARY]: [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3],
};
export var SessionStatus;
(function (SessionStatus) {
    SessionStatus["SCHEDULED"] = "SCHEDULED";
    SessionStatus["IN_PROGRESS"] = "IN_PROGRESS";
    SessionStatus["COMPLETED"] = "COMPLETED";
    SessionStatus["CANCELLED"] = "CANCELLED";
})(SessionStatus || (SessionStatus = {}));
export var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["ABSENT"] = "ABSENT";
    AttendanceStatus["LATE"] = "LATE";
    AttendanceStatus["EXCUSED"] = "EXCUSED";
})(AttendanceStatus || (AttendanceStatus = {}));
export var TransactionType;
(function (TransactionType) {
    TransactionType["INCOME"] = "INCOME";
    TransactionType["EXPENSE"] = "EXPENSE";
})(TransactionType || (TransactionType = {}));
export var TransactionCategory;
(function (TransactionCategory) {
    // Income categories
    TransactionCategory["SUBSCRIPTION"] = "SUBSCRIPTION";
    TransactionCategory["NOTEBOOK_SALE"] = "NOTEBOOK_SALE";
    TransactionCategory["NOTEBOOK_RESERVATION"] = "NOTEBOOK_RESERVATION";
    TransactionCategory["NOTEBOOK_DELIVERY"] = "NOTEBOOK_DELIVERY";
    TransactionCategory["OTHER_INCOME"] = "OTHER_INCOME";
    // Expense categories
    TransactionCategory["SALARY"] = "SALARY";
    TransactionCategory["RENT"] = "RENT";
    TransactionCategory["SUPPLIES"] = "SUPPLIES";
    TransactionCategory["OTHER_EXPENSE"] = "OTHER_EXPENSE";
})(TransactionCategory || (TransactionCategory = {}));
export var QuestionType;
(function (QuestionType) {
    QuestionType["MCQ"] = "MCQ";
    QuestionType["TRUE_FALSE"] = "TRUE_FALSE";
    QuestionType["ESSAY"] = "ESSAY";
})(QuestionType || (QuestionType = {}));
export var ExamStatus;
(function (ExamStatus) {
    ExamStatus["DRAFT"] = "DRAFT";
    ExamStatus["PUBLISHED"] = "PUBLISHED";
    ExamStatus["COMPLETED"] = "COMPLETED";
})(ExamStatus || (ExamStatus = {}));
export var ExamSource;
(function (ExamSource) {
    ExamSource["MANUAL"] = "MANUAL";
    ExamSource["AI_GENERATED"] = "AI_GENERATED";
})(ExamSource || (ExamSource = {}));
//# sourceMappingURL=enum.service.js.map