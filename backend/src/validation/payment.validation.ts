import { z } from 'zod';
import { GradeLevel, TransactionCategory } from '../common/enums/enum.service.js';
import { Types } from 'mongoose';

const objectId = z.string().length(24, 'معرف غير صحيح');

export const recordSubscriptionSchema = z.object({
  body: z.object({
    studentId:      objectId,
    discountAmount: z.number().min(0).optional(),
    description:    z.string().max(300).optional(),
    date:           z.string().optional(),
  }),
});

export const batchSubscriptionSchema = z.object({
  body: z.object({
    studentIds:     z.array(objectId).min(1, 'يجب اختيار طالب واحد على الأقل').max(100, 'الحد الأقصى 100 طالب'),
    discountAmount: z.number().min(0).optional(),
    description:    z.string().max(300).optional(),
    date:           z.string().optional(),
  }),
});

export const recordExpenseSchema = z.object({
  body: z.object({
    category:    z.nativeEnum(TransactionCategory, { error: () => ({ message: 'تصنيف المصروف غير صحيح' }) }),
    amount:      z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
    description: z.string().max(300).optional(),
    date:        z.string().optional(),
  }),
});

export const recordNotebookSaleSchema = z.object({
  body: z.object({
    notebookId: objectId,
    studentId:  objectId,
    quantity:   z.number().int().positive('الكمية يجب أن تكون أكبر من صفر').optional(),
    date:       z.string().optional(),
  }),
});

export const upsertPriceSettingsSchema = z.object({
  body: z.object({
    prices: z.array(z.object({
      gradeLevel: z.nativeEnum(GradeLevel),
      amount:     z.number().positive('السعر يجب أن يكون أكبر من صفر'),
    })).min(1, 'يجب تحديد سعر على الأقل'),
  }),
});

export const updateTransactionSchema = z.object({
  params: z.object({
    id: z.string().refine((v) => Types.ObjectId.isValid(v), { message: 'معرف المعاملة غير صحيح' }),
  }),
  body: z.object({
    amount:      z.number().positive('المبلغ يجب أن يكون أكبر من صفر').optional(),
    category:    z.nativeEnum(TransactionCategory, { error: () => ({ message: 'الفئة غير صحيحة' }) }).optional(),
    description: z.string().max(300).optional(),
    date:        z.string().optional(),
  }).refine((b) => Object.keys(b).length > 0, { message: 'يجب تحديد حقل واحد على الأقل للتعديل' }),
});
