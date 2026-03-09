import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  body: z.object({
    teacherId: z.string().length(24, "معرف المعلم غير صالح"),
    planTier: z.enum(['BASIC', 'PRO', 'PREMIUM']),
    durationMonths: z.union([z.literal(1), z.literal(4), z.literal(9), z.literal(12)]),
    paymentMethod: z.string().optional(),
  }),
});
