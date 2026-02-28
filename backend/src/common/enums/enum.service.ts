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

export enum GradeLevel {
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
    [GradeLevel.PREP_1]: 'A',
    [GradeLevel.PREP_2]: 'B',
    [GradeLevel.PREP_3]: 'C',
    [GradeLevel.SEC_1]:  'D',
    [GradeLevel.SEC_2]:  'E',
    [GradeLevel.SEC_3]:  'F',
};

// Grades visible per teacher stage
export enum TeacherStage {
    PREPARATORY = 'PREPARATORY',  // إعدادي
    SECONDARY   = 'SECONDARY',    // ثانوي
}

export const STAGE_GRADES: Record<TeacherStage, GradeLevel[]> = {
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
}

export enum TransactionType {
    INCOME  = 'INCOME',
    EXPENSE = 'EXPENSE',
}

export enum TransactionCategory {
    // Income categories
    SUBSCRIPTION  = 'SUBSCRIPTION',   
    NOTEBOOK_SALE = 'NOTEBOOK_SALE',  
    OTHER_INCOME  = 'OTHER_INCOME',   
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
