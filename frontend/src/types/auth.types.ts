/**
 * Authentication Types
 */

export interface User {
    id: string;
    name: string;
    role: 'superAdmin' | 'teacher' | 'assistant' | 'centerOwner' | 'centerSupervisor';
    stages?: ('PRIMARY' | 'PREPARATORY' | 'SECONDARY')[];
    teacherId?: string | null;
    teacherName?: string | null;
    centerName?: string;
    logoUrl?: string;
    assistantsAccessEnabled?: boolean;
    planTier?: 'MINI' | 'BASIC' | 'PREMIUM' | 'CENTER' | null;
    centerId?: string | null;
    supervisorType?: 'FINANCIAL' | 'ATTENDANCE' | 'CUSTOM' | null;
    supervisorPermissions?: {
        canViewFinancials?: boolean;
        canRecordPayments?: boolean;
        canManageExpenses?: boolean;
        canViewReports?: boolean;
        canTakeAttendance?: boolean;
        canEditAttendance?: boolean;
        canViewAttendance?: boolean;
        canManageStudents?: boolean;
        canManageTeachers?: boolean;
        canManagePackages?: boolean;
        canCreateExams?: boolean;
        canSendNotifications?: boolean;
    };
    features?: {
        homeworkTracking?: boolean;
    };
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}
