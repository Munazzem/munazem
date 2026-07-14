export enum UserRole {
    superAdmin = 'superAdmin',
    teacher = 'teacher',
    assistant = 'assistant',
}

export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',
    EXPIRED = 'EXPIRED',
    PENDING = 'PENDING'
}

export enum SubscriptionPlan {
    MINI    = 'MINI',
    BASIC   = 'BASIC',
    PREMIUM = 'PREMIUM',
}

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
    [SubscriptionPlan.MINI]:    500,
    [SubscriptionPlan.BASIC]:   900,
    [SubscriptionPlan.PREMIUM]: 1200,
};

// Configuration for dynamic student-based pricing
export const PLAN_CONFIG: Record<SubscriptionPlan, { baseStudents: number; extraPricePer100: number }> = {
    [SubscriptionPlan.MINI]:    { baseStudents: 250, extraPricePer100: 250 },
    [SubscriptionPlan.BASIC]:   { baseStudents: 500, extraPricePer100: 200 },
    [SubscriptionPlan.PREMIUM]: { baseStudents: 500, extraPricePer100: 200 },
};

export const DURATION_MONTHS = [1, 4, 9, 12] as const;
export type DurationMonths = number;

export const DURATION_LABELS: Record<DurationMonths, string> = {
    1:  'شهر واحد',
    4:  'ترم دراسي (4 أشهر)',
    9:  'ترمين دراسيين (9 أشهر)',
    12: 'سنة كاملة (12 شهر)',
};

export enum GradeLevel {
    // ابتدائي
    PRIM_1 = 'الصف الأول الابتدائي',
    PRIM_2 = 'الصف الثاني الابتدائي',
    PRIM_3 = 'الصف الثالث الابتدائي',
    PRIM_4 = 'الصف الرابع الابتدائي',
    PRIM_5 = 'الصف الخامس الابتدائي',
    PRIM_6 = 'الصف السادس الابتدائي',
    // إعدادي
    PREP_1 = 'الصف الأول الإعدادي',
    PREP_2 = 'الصف الثاني الإعدادي',
    PREP_3 = 'الصف الثالث الإعدادي',
    // ثانوي
    SEC_1  = 'الصف الأول الثانوي',
    SEC_2  = 'الصف الثاني الثانوي',
    SEC_3  = 'الصف الثالث الثانوي',
}

// Letter code per grade — used in student auto-generated code (e.g. 5A, 12C)
export const GRADE_LETTER: Record<GradeLevel, string> = {
    [GradeLevel.PRIM_1]: 'G',
    [GradeLevel.PRIM_2]: 'H',
    [GradeLevel.PRIM_3]: 'I',
    [GradeLevel.PRIM_4]: 'J',
    [GradeLevel.PRIM_5]: 'K',
    [GradeLevel.PRIM_6]: 'L',
    [GradeLevel.PREP_1]: 'A',
    [GradeLevel.PREP_2]: 'B',
    [GradeLevel.PREP_3]: 'C',
    [GradeLevel.SEC_1]:  'D',
    [GradeLevel.SEC_2]:  'E',
    [GradeLevel.SEC_3]:  'F',
};

// Grades visible per teacher stage
export enum TeacherStage {
    PRIMARY     = 'PRIMARY',
    PREPARATORY = 'PREPARATORY',  
    SECONDARY   = 'SECONDARY',    
}

export const STAGE_GRADES: Record<TeacherStage, GradeLevel[]> = {
    [TeacherStage.PRIMARY]:     [GradeLevel.PRIM_1, GradeLevel.PRIM_2, GradeLevel.PRIM_3, GradeLevel.PRIM_4, GradeLevel.PRIM_5, GradeLevel.PRIM_6],
    [TeacherStage.PREPARATORY]: [GradeLevel.PREP_1, GradeLevel.PREP_2, GradeLevel.PREP_3],
    [TeacherStage.SECONDARY]:   [GradeLevel.SEC_1, GradeLevel.SEC_2, GradeLevel.SEC_3],
};

export enum SessionStatus {
    SCHEDULED   = 'SCHEDULED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED   = 'COMPLETED',
    CANCELLED   = 'CANCELLED',
}

export enum AttendanceStatus {
    PRESENT = 'PRESENT',
    ABSENT  = 'ABSENT',
    LATE    = 'LATE',
    EXCUSED = 'EXCUSED',
}

export enum TransactionType {
    INCOME  = 'INCOME',
    EXPENSE = 'EXPENSE',
}

export enum TransactionCategory {
    // Income categories
    SUBSCRIPTION         = 'SUBSCRIPTION',   
    NOTEBOOK_SALE        = 'NOTEBOOK_SALE',  
    NOTEBOOK_RESERVATION = 'NOTEBOOK_RESERVATION',
    NOTEBOOK_DELIVERY    = 'NOTEBOOK_DELIVERY',
    OTHER_INCOME         = 'OTHER_INCOME',   
    // Expense categories
    SALARY        = 'SALARY',         
    RENT          = 'RENT',           
    SUPPLIES      = 'SUPPLIES',       
    OTHER_EXPENSE = 'OTHER_EXPENSE',  
}

export enum QuestionType {
    MCQ        = 'MCQ',         
    TRUE_FALSE = 'TRUE_FALSE',  
    ESSAY      = 'ESSAY',       
}

export enum ExamStatus {
    DRAFT     = 'DRAFT',      
    PUBLISHED = 'PUBLISHED',  
    COMPLETED = 'COMPLETED',  
}

export enum ExamSource {
    MANUAL       = 'MANUAL',        
    AI_GENERATED = 'AI_GENERATED',  
}
