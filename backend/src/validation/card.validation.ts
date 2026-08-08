import { z } from 'zod';

export const generateBatchSchema = z.object({
    body: z.object({
        count: z
            .number({ message: 'العدد يجب أن يكون رقماً' })
            .int('العدد يجب أن يكون رقماً صحيحاً')
            .min(1,    'الحد الأدنى للكروت هو 1')
            .max(1000, 'الحد الأقصى للطلب الواحد هو 1000 كارت'),
    }),
});

export const linkCardSchema = z.object({
    body: z.object({
        cardNumber: z.string().min(1, 'رقم الكارت مطلوب').trim(),
        studentId:  z.string().min(1, 'معرف الطالب مطلوب').trim(),
    }),
});

export const unlinkCardSchema = z.object({
    body: z.object({
        cardNumber: z.string().min(1, 'رقم الكارت مطلوب').trim(),
    }),
});

export const disableCardSchema = z.object({
    body: z.object({
        cardNumber: z.string().min(1, 'رقم الكارت مطلوب').trim(),
        reason: z
            .enum(['LOST', 'DAMAGED', 'MANUAL'], {
                message: 'سبب التعطيل غير صحيح — يجب أن يكون: LOST أو DAMAGED أو MANUAL'
            }),
    }),
});

export const replaceCardSchema = z.object({
    body: z.object({
        oldCardNumber: z.string().min(1, 'رقم الكارت القديم مطلوب').trim(),
        newCardNumber: z.string().min(1, 'رقم الكارت الجديد مطلوب').trim(),
    }),
});
