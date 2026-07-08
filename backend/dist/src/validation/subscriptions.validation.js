import { z } from 'zod';
export const createSubscriptionSchema = z.object({
    body: z.object({
        teacherId: z.string().length(24, "معرف المعلم غير صالح"),
        planTier: z.enum(['MINI', 'BASIC', 'PREMIUM']),
        durationMonths: z.number().min(1, 'المدة يجب أن تكون شهراً واحداً على الأقل').optional(),
        isFreeTrial: z.boolean().optional(),
        studentsCount: z.number().min(0, "عدد الطلاب غير صالح").optional(),
        paymentMethod: z.string().optional(),
        promoCode: z.string().optional(),
    }),
});
//# sourceMappingURL=subscriptions.validation.js.map