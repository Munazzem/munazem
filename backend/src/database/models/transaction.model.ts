import mongoose, { Schema, Model } from 'mongoose';
import type { ITransactionDocument } from '../../types/transaction.types.js';
import { TransactionType, TransactionCategory, GradeLevel } from '../../common/enums/enum.service.js';

const transactionSchema = new Schema<ITransactionDocument>({
    teacherId: {
        type: Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId, ref: 'User', required: true,
    },
    type: {
        type: String, enum: Object.values(TransactionType), required: true,
    },
    category: {
        type: String, enum: Object.values(TransactionCategory), required: true,
    },
    // Student-related — optional (income only)
    studentId: {
        type: Schema.Types.ObjectId, ref: 'Student',
    },
    studentName: {
        type: String,  // Embedded for fast reads — no populate needed
    },
    gradeLevel: {
        type: String, enum: Object.values(GradeLevel),
    },
    // Amounts
    originalAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0,    min: 0 },
    paidAmount:     { type: Number, required: true, min: 0 },
    // Meta
    description: { type: String },
    date: {
        type: Date, required: true, index: true,  // transaction date
    },
}, {
    timestamps: true,
});

// Fast queries: all transactions for a teacher in a date range
transactionSchema.index({ teacherId: 1, date: -1 });

// Fast queries: all transactions for a specific student
transactionSchema.index({ teacherId: 1, studentId: 1, date: -1 });

export const TransactionModel: Model<ITransactionDocument> =
    mongoose.model<ITransactionDocument>('Transaction', transactionSchema);
