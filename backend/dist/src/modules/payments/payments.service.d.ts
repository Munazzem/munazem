import mongoose from 'mongoose';
import { TransactionCategory } from '../../common/enums/enum.service.js';
import type { IPriceSetting } from '../../types/price-settings.types.js';
export declare class PaymentsService {
    static upsertPriceSettings(teacherId: string, prices: IPriceSetting[]): Promise<import("../../types/price-settings.types.js").IPriceSettingsDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static getPriceSettings(teacherId: string): Promise<any>;
    static recordSubscription(teacherId: string, createdBy: string, data: {
        studentId: string;
        discountAmount?: number;
        description?: string;
        date?: string;
    }): Promise<(mongoose.Document<unknown, {}, import("../../types/transaction.types.js").ITransactionDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/transaction.types.js").ITransactionDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static recordBatchSubscription(teacherId: string, createdBy: string, data: {
        studentIds: string[];
        discountAmount?: number;
        description?: string;
        date?: string;
    }): Promise<{
        results: {
            studentId: string;
            studentName: string;
            paidAmount: number;
            status: "success" | "error";
            error?: string;
        }[];
        successCount: number;
        failCount: number;
        totalPaid: number;
    }>;
    static recordNotebookSale(teacherId: string, createdBy: string, data: {
        studentId: string;
        notebookId: string;
        quantity?: number;
        discountAmount?: number;
        description?: string;
        date?: string;
    }): Promise<(mongoose.Document<unknown, {}, import("../../types/transaction.types.js").ITransactionDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/transaction.types.js").ITransactionDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static reserveNotebook(teacherId: string, createdBy: string, data: {
        studentId: string;
        notebookId: string;
        quantity?: number;
        paidAmount?: number;
        description?: string;
    }): Promise<(mongoose.Document<unknown, {}, import("../../types/notebook-reservation.types.js").INotebookReservationDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/notebook-reservation.types.js").INotebookReservationDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static deliverNotebook(teacherId: string, createdBy: string, reservationId: string, data: {
        paidAmount?: number;
        description?: string;
    }): Promise<mongoose.Document<unknown, {}, import("../../types/notebook-reservation.types.js").INotebookReservationDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/notebook-reservation.types.js").INotebookReservationDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static recordExpense(teacherId: string, createdBy: string, data: {
        category: TransactionCategory;
        amount: number;
        description?: string;
        date?: string;
    }): Promise<(mongoose.Document<unknown, {}, import("../../types/transaction.types.js").ITransactionDocument, {}, mongoose.DefaultSchemaOptions> & import("../../types/transaction.types.js").ITransactionDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static getDailyLedger(teacherId: string, date: string): Promise<{
        monthlyIncome: number;
        monthlyExpenses: number;
        teacherId: mongoose.Types.ObjectId;
        date: Date;
        transactions: import("../../types/ledger.types.js").IDailyTransaction[];
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
        createdAt?: Date;
        updatedAt?: Date;
        _id: mongoose.Types.ObjectId;
        $locals: Record<string, unknown>;
        $op: "save" | "validate" | "remove" | null;
        $where: Record<string, unknown>;
        baseModelName?: string;
        collection: mongoose.Collection;
        db: mongoose.Connection;
        errors?: mongoose.Error.ValidationError;
        isNew: boolean;
        schema: mongoose.Schema;
        __v: number;
    } | {
        monthlyIncome: number;
        monthlyExpenses: number;
        date: Date;
        transactions: never[];
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
    }>;
    static getMonthlyLedger(teacherId: string, year: number, month: number): Promise<(import("../../types/ledger.types.js").IMonthlyLedgerDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }) | {
        year: number;
        month: number;
        dailySummaries: never[];
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
    }>;
    static updateTransaction(teacherId: string, transactionId: string, data: {
        amount?: number;
        category?: TransactionCategory;
        description?: string;
        date?: string;
    }): Promise<(import("../../types/transaction.types.js").ITransactionDocument & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
}
//# sourceMappingURL=payments.service.d.ts.map