import type { GradeLevel } from '@/lib/constants/grade.constants';
export type { GradeLevel };
export { ALL_GRADES } from '@/lib/constants/grade.constants';

// Re-export payment constants for backward compatibility
export { CATEGORY_LABELS, EXPENSE_CATEGORIES } from '@/lib/constants/payment.constants';

export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory =
    | 'SUBSCRIPTION'
    | 'NOTEBOOK_SALE'
    | 'NOTEBOOK_RESERVATION'
    | 'NOTEBOOK_DELIVERY'
    | 'OTHER_INCOME'
    | 'SALARY'
    | 'RENT'
    | 'SUPPLIES'
    | 'OTHER_EXPENSE';

export interface ITransaction {
    _id: string;
    teacherId: string;
    createdBy: string;
    type: TransactionType;
    category: TransactionCategory;
    studentId?: string;
    studentName?: string;
    gradeLevel?: GradeLevel;
    originalAmount: number;
    discountAmount: number;
    paidAmount: number;
    description?: string;
    date: string;
    createdAt: string;
}

export interface IDailyLedgerTransaction {
    transactionId: string;
    type: TransactionType;
    category: TransactionCategory;
    paidAmount: number;
    studentName?: string;
    description?: string;
    createdBy: string;
    time: string;
}

export interface IDailyLedger {
    teacherId?: string;
    date: string;
    transactions: IDailyLedgerTransaction[];
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
}

export interface IDailySummary {
    date: string;
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    transactionCount: number;
}

export interface IMonthlyLedger {
    year: number;
    month: number;
    dailySummaries: IDailySummary[];
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
}

export interface IPriceSetting {
    gradeLevel: GradeLevel;
    amount: number;
}

export interface IPriceSettings {
    teacherId: string;
    prices: IPriceSetting[];
}

// ── Batch Operations ────────────────────────────────────────────────

export interface IBatchSubscriptionResult {
    studentId:   string;
    studentName: string;
    paidAmount:  number;
    status:      'success' | 'error';
    error?:      string;
}

export interface IBatchSubscriptionResponse {
    results:      IBatchSubscriptionResult[];
    successCount: number;
    failCount:    number;
    totalPaid:    number;
}
