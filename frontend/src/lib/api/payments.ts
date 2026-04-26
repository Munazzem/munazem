import { apiClient } from './axios';
import type {
    IDailyLedger,
    IMonthlyLedger,
    IPriceSettings,
    IPriceSetting,
    ITransaction,
    GradeLevel,
    TransactionCategory,
} from '@/types/payment.types';

// ─── Price Settings ───────────────────────────────────────────────
export const getPriceSettings = async (): Promise<IPriceSettings> => {
    const res = await apiClient.get('/payments/prices');
    return (res as any).data;
};

export const savePriceSettings = async (prices: IPriceSetting[]): Promise<IPriceSettings> => {
    const res = await apiClient.put('/payments/prices', { prices });
    return (res as any).data;
};

// ─── Ledgers ──────────────────────────────────────────────────────
export const getDailyLedger = async (date: string): Promise<IDailyLedger> => {
    const res = await apiClient.get(`/payments/ledger/daily?date=${date}`);
    return (res as any).data;
};

export const getMonthlyLedger = async (year: number, month: number): Promise<IMonthlyLedger> => {
    const res = await apiClient.get(`/payments/ledger/monthly?year=${year}&month=${month}`);
    return (res as any).data;
};

// ─── Transactions ─────────────────────────────────────────────────
export const recordSubscription = async (data: {
    studentId: string;
    discountAmount?: number;
    description?: string;
    date?: string;
}): Promise<ITransaction> => {
    const res = await apiClient.post('/payments/subscription', data);
    return (res as any).data;
};

export const recordNotebookSale = async (data: {
    studentId: string;
    notebookId: string;
    quantity?: number;
    discountAmount?: number;
    description?: string;
    date?: string;
}): Promise<ITransaction> => {
    const res = await apiClient.post('/payments/notebook', data);
    return (res as any).data;
};

export interface IBatchSubscriptionResult {
    studentId: string;
    studentName: string;
    paidAmount: number;
    status: 'success' | 'error';
    error?: string;
}

export interface IBatchSubscriptionResponse {
    results: IBatchSubscriptionResult[];
    successCount: number;
    failCount: number;
    totalPaid: number;
}

export const recordBatchSubscription = async (data: {
    studentIds: string[];
    discountAmount?: number;
    description?: string;
    date?: string;
}): Promise<IBatchSubscriptionResponse> => {
    const res = await apiClient.post('/payments/subscription/batch', data);
    return (res as any).data;
};

export const recordExpense = async (data: {
    category: TransactionCategory;
    amount: number;
    description?: string;
    date?: string;
}): Promise<ITransaction> => {
    const res = await apiClient.post('/payments/expense', data);
    return (res as any).data;
};

export const updateTransaction = async (
    transactionId: string,
    data: {
        amount?: number;
        category?: TransactionCategory;
        description?: string;
        date?: string;
    }
): Promise<ITransaction> => {
    const res = await apiClient.patch(`/payments/${transactionId}`, data);
    return (res as any).data;
};
