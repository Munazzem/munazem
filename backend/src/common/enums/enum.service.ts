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
    PRIMARY_1 = 'الصف الأول الابتدائي',
    PRIMARY_2 = 'الصف الثاني الابتدائي',
    PRIMARY_3 = 'الصف الثالث الابتدائي',
    PRIMARY_4 = 'الصف الرابع الابتدائي',
    PRIMARY_5 = 'الصف الخامس الابتدائي',
    PRIMARY_6 = 'الصف السادس الابتدائي',
    PREP_1 = 'الصف الأول الإعدادي',
    PREP_2 = 'الصف الثاني الإعدادي',
    PREP_3 = 'الصف الثالث الإعدادي',
    SEC_1 = 'الصف الأول الثانوي',
    SEC_2 = 'الصف الثاني الثانوي',
    SEC_3 = 'الصف الثالث الثانوي',
}

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
