import { GradeLevel } from '../common/enums/enum.service.js';
import type { ISchedule } from './group.types.js';

// ─── Student DTOs ──────────────────────────────────────────────
export interface CreateStudentDTO {
    fullName: string;
    studentPhone: string;
    parentPhone: string;
    gradeLevel: GradeLevel;
    groupId: string;
    barcode?: string;
}

export interface UpdateStudentDTO {
    fullName?: string;
    studentPhone?: string;
    parentPhone?: string;
    gradeLevel?: GradeLevel;
    groupId?: string;
    barcode?: string;
    isActive?: boolean;
}

// ─── Group DTOs ────────────────────────────────────────────────
export interface CreateGroupDTO {
    name: string;
    gradeLevel: GradeLevel;
    schedule: ISchedule[];
    capacity?: number;
}

export interface UpdateGroupDTO {
    name?: string;
    gradeLevel?: GradeLevel;
    schedule?: ISchedule[];
    capacity?: number;
    isActive?: boolean;
}

// ─── User DTOs ─────────────────────────────────────────────────
export interface CreateUserDTO {
    name: string;
    phone: string;
    email?: string;
    password: string;
    subscription?: {
        amount: number;
        endDate: string;
        paymentMethod?: string;
    };
}

// ─── Subscription DTOs ─────────────────────────────────────────
export interface CreateSubscriptionDTO {
    endDate: string;
    amount: number;
    paymentMethod?: string;
}
