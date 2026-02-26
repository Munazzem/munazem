import { Document, Types } from 'mongoose';

export interface IStudent {
    studentName: string;
    parentName: string;
    studentPhone: string;
    parentPhone: string;
    gradeLevel: string;
    barcode?: string;
    groupId: Types.ObjectId;
    teacherId: Types.ObjectId;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IStudentDocument extends IStudent, Document {}
