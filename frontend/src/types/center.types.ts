export type CenterSupervisorType = 'FINANCIAL' | 'ATTENDANCE' | 'CUSTOM';
export type CenterGroupType = 'PACKAGE' | 'PRIVATE' | 'MIXED';
export type CenterEnrollmentType = 'PACKAGE' | 'PRIVATE' | 'BOTH';

export interface ISupervisorPermissions {
    canViewFinancials: boolean;
    canRecordPayments: boolean;
    canManageExpenses: boolean;
    canViewReports: boolean;
    canTakeAttendance: boolean;
    canEditAttendance: boolean;
    canViewAttendance: boolean;
    canManageStudents: boolean;
    canManageTeachers: boolean;
    canManagePackages: boolean;
    canCreateExams: boolean;
    canSendNotifications: boolean;
}

export interface ICenter {
    _id: string;
    name: string;
    ownerId: string;
    logoUrl?: string | null;
    phone?: string | null;
    address?: string | null;
    parentCenterId?: string | null; // null = main center, string = branch
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ICenterTeacher {
    _id: string;
    centerId: string;
    name: string;
    subject: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ICenterPackageTeacher {
    teacherId: string | ICenterTeacher;
    subject?: string;
}

export interface ICenterPackage {
    _id: string;
    centerId: string;
    name: string;
    gradeLevel: string;
    teachers: ICenterPackageTeacher[];
    monthlyPrice: number;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ICenterGroupSchedule {
    day: string;
    time: string;
}

export interface ICenterGroup {
    _id: string;
    centerId: string;
    centerTeacherId: string | ICenterTeacher;
    name: string;
    gradeLevel: string;
    groupType: CenterGroupType;
    schedule: ICenterGroupSchedule[];
    capacity: number;
    privateMonthlyPrice?: number | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface IDiscount {
    type: 'PERCENTAGE' | 'FIXED' | null;
    value: number;
}

export interface IPrivateTeacherEnrollment {
    centerTeacherId: string | ICenterTeacher;
    groupId?: string | ICenterGroup;
    subject?: string;
    monthlyPrice?: number;
    sessionsPerWeek?: number;
}

export interface ICenterEnrollment {
    _id: string;
    centerId: string;
    studentId: {
        _id: string;
        studentName: string;
        studentCode: string;
        studentPhone?: string;
        gradeLevel: string;
        parentPhone?: string;
        barcode?: string;
    };
    type: CenterEnrollmentType;
    packageId?: {
        _id: string;
        name: string;
        gradeLevel: string;
        monthlyPrice: number;
    } | null;
    packageMonthlyPrice?: number | null;
    packageDiscount?: IDiscount;
    packageGroups?: Array<string | ICenterGroup>;
    privateTeachers?: IPrivateTeacherEnrollment[];
    privateDiscount?: IDiscount;
    combinedDiscount?: IDiscount;
    isActive: boolean;
    startDate: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ICenterAttendanceRecord {
    _id: string;
    centerId: string;
    groupId: string | ICenterGroup;
    studentId: {
        _id: string;
        studentName: string;
        studentCode: string;
        barcode?: string;
    };
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    source: 'MANUAL' | 'QR_SCAN';
    scannedAt?: string;
    recordedBy?: {
        _id: string;
        name: string;
        role: string;
    };
    notes?: string;
}

export interface ICenterFinancialSummary {
    packageRevenue: number;
    privateRevenue: number;
    combinedRevenue: number;
    totalRevenue: number;
    totalDebt: number;
    breakdown: Array<{
        _id: string;
        totalPaid: number;
        totalRemaining: number;
        totalOriginal: number;
        count: number;
    }>;
}

export interface ITeacherFinancialReport {
    teacherId: string;
    transactions: any[];
    totalPaid: number;
    totalRemaining: number;
    transactionCount: number;
}

export interface ICenterTransaction {
    _id: string;
    studentId?: any;
    studentName?: string;
    studentCode?: string;
    studentPhone?: string;
    parentPhone?: string;
    gradeLevel?: string;
    category: 'CENTER_PACKAGE' | 'CENTER_PRIVATE' | 'CENTER_COMBINED';
    centerTeacherId?: {
        _id: string;
        name: string;
        subject?: string;
    };
    originalAmount: number;
    discountAmount: number;
    paidAmount: number;
    remainingAmount: number;
    description?: string;
    date: string;
    createdAt?: string;
    createdBy?: {
        _id: string;
        name: string;
        role?: string;
    };
}

export interface IDailyTallyReport {
    date: string;
    totalPaid: number;
    packageRevenue: number;
    privateRevenue: number;
    combinedRevenue: number;
    totalDebt: number;
    transactionCount: number;
    transactions: ICenterTransaction[];
}

export interface IMonthlyTallyReport {
    year: number;
    month: number;
    totalPaid: number;
    packageRevenue: number;
    privateRevenue: number;
    combinedRevenue: number;
    totalDebt: number;
    transactionCount: number;
    dailyBreakdown: Array<{
        day: number;
        date: string;
        totalPaid: number;
        packageRevenue: number;
        privateRevenue: number;
        combinedRevenue: number;
        totalDebt: number;
        count: number;
    }>;
    transactions: ICenterTransaction[];
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateCenterDTO {
    name: string;
    phone?: string | null;
    address?: string | null;
    logoUrl?: string | null;
}

export interface CreateBranchDTO {
    name: string;
    phone?: string | null;
    address?: string | null;
}

export interface CreateTeacherDTO {
    name: string;
    subject: string;
}

export interface CreatePackageDTO {
    name: string;
    gradeLevel: string;
    teachers: Array<{ teacherId: string; subject?: string }>;
    monthlyPrice: number;
}

export interface CreateGroupDTO {
    name: string;
    gradeLevel: string;
    centerTeacherId: string;
    groupType: CenterGroupType;
    schedule: ICenterGroupSchedule[];
    capacity?: number;
    privateMonthlyPrice?: number | null;
}

export interface CreateSupervisorDTO {
    name: string;
    phone: string;
    password?: string;
    supervisorType: CenterSupervisorType;
    branchId?: string | null;
    supervisorPermissions?: Partial<ISupervisorPermissions>;
}

export interface EnrollStudentDTO {
    studentId: string;
    type: CenterEnrollmentType;
    packageId?: string | null;
    packageDiscount?: IDiscount;
    packageGroups?: string[];
    privateTeachers?: Array<{
        centerTeacherId: string;
        groupId?: string;
        subject?: string;
        monthlyPrice?: number;
        sessionsPerWeek?: number;
    }>;
    privateDiscount?: IDiscount;
    combinedDiscount?: IDiscount;
}

export interface RecordAttendanceDTO {
    groupId: string;
    studentId: string;
    date: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    source?: 'MANUAL' | 'QR_SCAN';
    notes?: string;
}

export interface RecordPaymentDTO {
    studentId: string;
    centerTeacherId?: string | null;
    category: 'CENTER_PACKAGE' | 'CENTER_PRIVATE' | 'CENTER_COMBINED';
    originalAmount: number;
    discountAmount?: number;
    paidAmount: number;
    remainingAmount?: number;
    description?: string;
    date?: string;
}

export interface ICenterStudent {
    _id: string;
    centerId: string;
    studentName: string;
    parentName: string;
    studentPhone?: string | null;
    parentPhone?: string | null;
    gradeLevel: string;
    studentCode: string;
    barcode?: string | null;
    notes?: string | null;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateCenterStudentDTO {
    studentName: string;
    parentName?: string;
    studentPhone?: string | null;
    parentPhone?: string | null;
    gradeLevel: string;
    barcode?: string | null;
    notes?: string | null;
}

export interface BulkCreateCenterStudentDTO {
    students: CreateCenterStudentDTO[];
}

export interface ICenterCheckIn {
    _id: string;
    centerId: string;
    studentId: string | ICenterStudent;
    date: string;
    checkInTime: string;
    source: 'QR_SCAN' | 'BARCODE' | 'MANUAL';
    attendedGroups: Array<string | ICenterGroup>;
    recordedBy?: { _id: string; name: string } | string;
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface CenterCheckInGroupInfo {
    _id: string;
    name: string;
    gradeLevel: string;
    groupType: string;
    centerTeacher?: { _id: string; name: string; subject: string } | null;
    scheduleTime?: string | null;
    schedule?: Array<{ day: string; time: string }>;
    isAttended: boolean;
}

export interface CenterCheckInResponse {
    student: ICenterStudent;
    checkIn: ICenterCheckIn;
    isNewCheckIn: boolean;
    todayArabicDay: string;
    scheduledTodayGroups: CenterCheckInGroupInfo[];
    otherEnrolledGroups: CenterCheckInGroupInfo[];
    attendedGroupIds: string[];
    financialStatus: {
        totalPaid: number;
        totalRemaining: number;
        hasDebt: boolean;
        hasActiveEnrollment: boolean;
        enrollmentType?: string | null;
    };
    enrollmentSummary?: {
        type?: string | null;
        packageName?: string | null;
        privateTeachersSummary?: string[];
    };
}

export interface EnrichedCenterCheckIn extends ICenterCheckIn {
    studentId: ICenterStudent;
    attendedGroups: ICenterGroup[];
    enrollment?: {
        _id: string;
        type: CenterEnrollmentType;
        packageId?: { _id: string; name: string } | null;
        packageGroups?: Array<{ _id: string; name: string }>;
        privateTeachers?: Array<{
            centerTeacherId?: { _id: string; name: string; subject?: string };
            groupId?: { _id: string; name: string };
        }>;
    } | null;
    totalRemainingDebt?: number;
}

export interface DailyCheckInsResult {
    checkIns: EnrichedCenterCheckIn[];
    total: number;
    stats: {
        totalCheckedIn: number;
        totalWithAttendedClasses: number;
        totalGeneralOnly: number;
    };
}


