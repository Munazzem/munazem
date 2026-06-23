import { Document, Types } from 'mongoose';
export interface IDailyTransaction {
    transactionId: Types.ObjectId;
    type: string;
    category: string;
    paidAmount: number;
    studentName?: string;
    description?: string;
    createdBy: Types.ObjectId;
    time: Date;
}
export interface IDailyLedger {
    teacherId: Types.ObjectId;
    date: Date;
    transactions: IDailyTransaction[];
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IDailyLedgerDocument extends IDailyLedger, Document {
}
export interface IDailySummary {
    date: Date;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
}
export interface IMonthlyLedger {
    teacherId: Types.ObjectId;
    year: number;
    month: number;
    dailySummaries: IDailySummary[];
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IMonthlyLedgerDocument extends IMonthlyLedger, Document {
}
//# sourceMappingURL=ledger.types.d.ts.map