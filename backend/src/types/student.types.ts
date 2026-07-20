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
    remainingSessions: number; // عدد الحصص المتبقية في دورة الاشتراك الحالية
    totalDebt: number; // إجمالي المبالغ المتبقية غير المسددة
    consecutiveAbsences?: number; // عدد مرات الغياب المتتالي
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStudentDocument extends IStudent, Document {}
