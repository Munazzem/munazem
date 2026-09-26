import { Document, Types } from 'mongoose';
import { CenterSupervisorType, CenterGroupType, CenterEnrollmentType, GradeLevel, AttendanceStatus } from '../common/enums/enum.service.js';

// ── Center ──────────────────────────────────────────────────────────
export interface ICenter {
    name:            string;
    ownerId:         Types.ObjectId;
    logoUrl?:        string | null;
    phone?:          string | null;
    address?:        string | null;
    parentCenterId?: Types.ObjectId | null; // null = main center
    isActive:        boolean;
    createdAt?:      Date;
    updatedAt?:      Date;
}
export interface ICenterDocument extends ICenter, Document {}

// ── Center Teacher (Entity — NOT a User) ────────────────────────────
export interface ICenterTeacher {
    centerId:             Types.ObjectId;
    name:                 string;
    subject:              string;
    privateMonthlyPrice?: number | null;
    isActive:             boolean;
    createdAt?:           Date;
    updatedAt?:           Date;
}
export interface ICenterTeacherDocument extends ICenterTeacher, Document {}

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
    source:      'MANUAL' | 'QR_SCAN';
    scannedAt:   Date;
    recordedBy?: Types.ObjectId;
    notes?:      string;
    createdAt?:  Date;
    updatedAt?:  Date;
}
export interface ICenterAttendanceDocument extends ICenterAttendance, Document {}

// ── Discount ────────────────────────────────────────────────────────
export interface IDiscount {
    type:  'PERCENTAGE' | 'FIXED' | null;
    value: number;
}

// ── Private Teacher Enrollment ──────────────────────────────────────
export interface IPrivateTeacherEnrollment {
    centerTeacherId:  Types.ObjectId;
    groupId?:         Types.ObjectId;
    subject?:         string;
    monthlyPrice?:    number;
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
