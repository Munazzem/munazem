import { Document, Types } from 'mongoose';
import { CenterSupervisorType, CenterGroupType, CenterEnrollmentType, GradeLevel, AttendanceStatus } from '../common/enums/enum.service.js';

// ── Center ──────────────────────────────────────────────────────────
export interface ICenterCardTemplate {
    frontImageUrl?: string | null;
    backImageUrl?:  string | null;
    frontDesignUrl?: string | null;
    backDesignUrl?:  string | null;
    themePreset?:    string;
    showCenterLogo?: boolean;
    showCenterName?: boolean;
    showStudentPhoto?: boolean;
    showStudentName?: boolean;
    showBarcode?:    boolean;
    showQrCode?:     boolean;
    showInstructions?: boolean;
    primaryColor?:   string;
    showMonazemLogo?: boolean;
    monazemLogoPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-top' | 'center-bottom';
    monazemLogoSide?: 'front' | 'back' | 'both';
    monazemLogoSize?: 'sm' | 'md' | 'lg';
    qrX?:            number;
    qrY?:            number;
    qrSize?:         number;
    showQrBg?:       boolean;
    showCardNumber?: boolean;
}

export interface ICenter {
    name:            string;
    ownerId:         Types.ObjectId;
    logoUrl?:        string | null;
    phone?:          string | null;
    address?:        string | null;
    parentCenterId?: Types.ObjectId | null; // null = main center
    cardTemplate?:   ICenterCardTemplate;
    isActive:        boolean;
    createdAt?:      Date;
    updatedAt?:      Date;
}
export interface ICenterDocument extends ICenter, Document {}

// ── Center Teacher (Entity — NOT a User) ────────────────────────────
export interface ICenterTeacher {
    centerId:   Types.ObjectId;
    name:       string;
    subject:    string;
    isActive:   boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface ICenterTeacherDocument extends ICenterTeacher, Document {}

// ── Center Student (belongs to the center, not a teacher) ────────────
export interface ICenterStudent {
    centerId:      Types.ObjectId;
    studentName:   string;
    parentName:    string;
    studentPhone?: string | null;
    parentPhone?:  string | null;
    gradeLevel:    GradeLevel;
    studentCode:   string;
    barcode?:      string | null;
    studentType?:  'PACKAGE' | 'PRIVATE' | 'BOTH' | string | null;
    notes?:        string | null;
    isActive:      boolean;
    createdAt?:    Date;
    updatedAt?:    Date;
}
export interface ICenterStudentDocument extends ICenterStudent, Document {}


// ── Center Package ──────────────────────────────────────────────────
export interface ICenterPackageTeacher {
    teacherId: Types.ObjectId;  // ref: CenterTeacher
    subject?:  string;
}

export interface ICenterPackage {
    centerId:     Types.ObjectId;
    name:         string;
    gradeLevel:   GradeLevel;
    teachers:     ICenterPackageTeacher[];
    monthlyPrice: number;
    isActive:     boolean;
    createdAt?:   Date;
    updatedAt?:   Date;
}
export interface ICenterPackageDocument extends ICenterPackage, Document {}

// ── Center Group ────────────────────────────────────────────────────
export interface ICenterGroupSchedule {
    day:  string;
    time: string;
}

export interface ICenterGroup {
    centerId:              Types.ObjectId;
    centerTeacherId:       Types.ObjectId;
    name:                  string;
    gradeLevel:            GradeLevel;
    groupType:             CenterGroupType;
    schedule:              ICenterGroupSchedule[];
    capacity?:             number;
    privateMonthlyPrice?:  number | null;
    isActive:              boolean;
    createdAt?:            Date;
    updatedAt?:            Date;
}
export interface ICenterGroupDocument extends ICenterGroup, Document {}

// ── Center Attendance (Quick Attendance — no sessions) ──────────────
export interface ICenterAttendance {
    centerId:    Types.ObjectId;
    groupId:     Types.ObjectId;
    studentId:   Types.ObjectId;
    date:        Date;
    status:      AttendanceStatus;
    source:      'MANUAL' | 'QR_SCAN' | 'GATE_CHECKIN';
    scannedAt:   Date;
    recordedBy?: Types.ObjectId;
    notes?:      string;
    createdAt?:  Date;
    updatedAt?:  Date;
}
export interface ICenterAttendanceDocument extends ICenterAttendance, Document {}

// ── Center Daily Check-In ───────────────────────────────────────────
export interface ICenterCheckIn {
    centerId:        Types.ObjectId;
    studentId:       Types.ObjectId;
    date:            Date;
    checkInTime:     Date;
    source:          'QR_SCAN' | 'BARCODE' | 'MANUAL';
    attendedGroups:  Types.ObjectId[];
    recordedBy?:     Types.ObjectId;
    notes?:          string | null;
    createdAt?:      Date;
    updatedAt?:      Date;
}
export interface ICenterCheckInDocument extends ICenterCheckIn, Document {}


// ── Discount ────────────────────────────────────────────────────────
export interface IDiscount {
    type:  'PERCENTAGE' | 'FIXED' | null;
    value: number;
}

// ── Private Teacher Enrollment ──────────────────────────────────────
export interface IPrivateTeacherEnrollment {
    centerTeacherId:  Types.ObjectId;
    groupId:          Types.ObjectId;  // required — price snapshot comes from group at enroll time
    subject?:         string;
    monthlyPrice?:    number;          // snapshot of group.privateMonthlyPrice at enrollment
    sessionsPerWeek?: number;
}

// ── Center Enrollment ───────────────────────────────────────────────
export interface ICenterEnrollment {
    centerId:             Types.ObjectId;
    studentId:            Types.ObjectId;
    type:                 CenterEnrollmentType;
    // Package
    packageId?:           Types.ObjectId | null;
    packageMonthlyPrice?: number | null;
    packageDiscount?:     IDiscount;
    packageGroups?:       Types.ObjectId[];
    // Private
    privateTeachers?:     IPrivateTeacherEnrollment[];
    privateDiscount?:     IDiscount;
    // Combined discount (if paying both together)
    combinedDiscount?:    IDiscount;
    isActive:             boolean;
    startDate:            Date;
    createdAt?:           Date;
    updatedAt?:           Date;
}
export interface ICenterEnrollmentDocument extends ICenterEnrollment, Document {}

// ── Supervisor Permissions ──────────────────────────────────────────
export interface ISupervisorPermissions {
    // Financial
    canViewFinancials:     boolean;
    canRecordPayments:     boolean;
    canManageExpenses:     boolean;
    canViewReports:        boolean;
    // Attendance
    canTakeAttendance:     boolean;
    canEditAttendance:     boolean;
    canViewAttendance:     boolean;
    // Management
    canManageStudents:     boolean;
    canManageTeachers:     boolean;
    canManagePackages:     boolean;
    canCreateExams:        boolean;
    canSendNotifications:  boolean;
}
