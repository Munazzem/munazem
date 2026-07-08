import { Document, Types } from 'mongoose';
import { TransactionType, TransactionCategory, GradeLevel } from '../common/enums/enum.service.js';
export interface ITransaction {
    teacherId: Types.ObjectId;
    createdBy: Types.ObjectId;
    type: TransactionType;
    category: TransactionCategory;
    studentId?: Types.ObjectId;
    studentName?: string;
    gradeLevel?: GradeLevel;
    originalAmount: number;
    discountAmount: number;
    paidAmount: number;
    description?: string;
    date: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface ITransactionDocument extends ITransaction, Document {
}
//# sourceMappingURL=transaction.types.d.ts.map