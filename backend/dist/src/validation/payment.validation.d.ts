import { z } from 'zod';
import { GradeLevel, TransactionCategory } from '../common/enums/enum.service.js';
export declare const recordSubscriptionSchema: z.ZodObject<{
    body: z.ZodObject<{
        studentId: z.ZodString;
        discountAmount: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const batchSubscriptionSchema: z.ZodObject<{
    body: z.ZodObject<{
        studentIds: z.ZodArray<z.ZodString>;
        discountAmount: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const recordExpenseSchema: z.ZodObject<{
    body: z.ZodObject<{
        category: z.ZodEnum<typeof TransactionCategory>;
        amount: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const recordNotebookSaleSchema: z.ZodObject<{
    body: z.ZodObject<{
        notebookId: z.ZodString;
        studentId: z.ZodString;
        quantity: z.ZodOptional<z.ZodNumber>;
        date: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const reserveNotebookSchema: z.ZodObject<{
    body: z.ZodObject<{
        notebookId: z.ZodString;
        studentId: z.ZodString;
        quantity: z.ZodOptional<z.ZodNumber>;
        paidAmount: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const deliverNotebookSchema: z.ZodObject<{
    body: z.ZodObject<{
        paidAmount: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const upsertPriceSettingsSchema: z.ZodObject<{
    body: z.ZodObject<{
        prices: z.ZodArray<z.ZodObject<{
            gradeLevel: z.ZodEnum<typeof GradeLevel>;
            amount: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateTransactionSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>;
    body: z.ZodObject<{
        amount: z.ZodOptional<z.ZodNumber>;
        category: z.ZodOptional<z.ZodEnum<typeof TransactionCategory>>;
        description: z.ZodOptional<z.ZodString>;
        date: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=payment.validation.d.ts.map