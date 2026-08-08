import { Document, Types } from 'mongoose';
import { GradeLevel } from '../common/enums/enum.service.js';

export interface IStudent {
    studentName: string;
    parentName: string;
    studentPhone: string;
    parentPhone: string;
    gradeLevel: GradeLevel;
    studentCode: string;
    barcode?: string;
    groupId: Types.ObjectId;
    teacherId: Types.ObjectId;
    isActive: boolean;
    monthlySessionsQuota: number;
    excusedUntil?: Date; // تاريخ نهاية الإذن (للتوافق القديم)
    excusedSessionsCount?: number; // عدد حصص الاستئذان المتبقية
    remainingSessions: number; // عدد الحصص المتبقية في الدورة الحالية (atomic counter)
    cycleStartedAt?: Date | null;  // تاريخ بداية الدورة الحالية
    cycleCapacity?: number | null; // سعة الدورة (مجمدة من group.schedule.length * 4 عند بداية الدورة)
    cycleNumber?: number;          // رقم الدورة (يزداد مع كل دورة مكتملة)
    totalDebt: number; // إجمالي المبالغ المتبقية غير المسددة
    consecutiveAbsences?: number; // عدد مرات الغياب المتتالي
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStudentDocument extends IStudent, Document {}
