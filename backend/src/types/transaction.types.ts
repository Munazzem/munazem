import { Document, Types } from 'mongoose';
import { TransactionType, TransactionCategory, GradeLevel } from '../common/enums/enum.service.js';

export interface ITransaction {
    teacherId:      Types.ObjectId;
    createdBy:      Types.ObjectId;       // who recorded (teacher or assistant)
    type:           TransactionType;
    category:       TransactionCategory;
    // Student-related (income only)
    studentId?:     Types.ObjectId;
    studentName?:   string;               // embedded for fast reads
    gradeLevel?:    GradeLevel;
    // Amounts
    originalAmount: number;               // from PriceSettings
    discountAmount: number;               // 0 if no discount
    paidAmount:     number;               // originalAmount - discountAmount
    // Meta
    description?:   string;
    date:           Date;                 // transaction date (not createdAt)
    createdAt?:     Date;
    updatedAt?:     Date;
}

export interface ITransactionDocument extends ITransaction, Document {}
