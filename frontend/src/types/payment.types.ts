export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory =
    | 'SUBSCRIPTION'
    | 'NOTEBOOK_SALE'
    | 'OTHER_INCOME'
    | 'SALARY'
    | 'RENT'
    | 'SUPPLIES'
    | 'OTHER_EXPENSE';

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
    SUBSCRIPTION:  'اشتراك طالب',
    NOTEBOOK_SALE: 'بيع مذكرة',
    OTHER_INCOME:  'دخل آخر',
    SALARY:        'رواتب',
    RENT:          'إيجار',
    SUPPLIES:      'مستلزمات',
    OTHER_EXPENSE: 'مصروف آخر',
};

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
    'SALARY', 'RENT', 'SUPPLIES', 'OTHER_EXPENSE',
];

export type GradeLevel =
    | 'الصف الأول الإعدادي'
    | 'الصف الثاني الإعدادي'
    | 'الصف الثالث الإعدادي'
    | 'الصف الأول الثانوي'
    | 'الصف الثاني الثانوي'
    | 'الصف الثالث الثانوي';

export const ALL_GRADES: GradeLevel[] = [
    'الصف الأول الإعدادي',
    'الصف الثاني الإعدادي',
    'الصف الثالث الإعدادي',
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
];

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
