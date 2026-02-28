import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  body: z.object({
    teacherId: z.string().length(24, "معرف المعلم غير صالح"),
    planTier: z.enum(['BASIC', 'PRO', 'PREMIUM'], {
      errorMap: () => ({ message: 'يجب اختيار باقة صالحة (BASIC أو PRO أو PREMIUM)' }),
    }),
    durationMonths: z.union(
      [z.literal(1), z.literal(4), z.literal(9), z.literal(12)],
      { errorMap: () => ({ message: 'مدة الاشتراك يجب أن تكون 1 أو 4 أو 9 أو 12 شهراً' }) }
    ),
    paymentMethod: z.string().optional(),
  }),
});
