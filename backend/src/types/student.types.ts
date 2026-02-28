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
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStudentDocument extends IStudent, Document {}
