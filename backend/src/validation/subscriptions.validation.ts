import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  body: z.object({
    teacherId: z.string().length(24, "معرف المعلم غير صالح"),
    endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: "تاريخ غير صالح",
    }),
    amount: z.number().positive("مبلغ الاشتراك يجب أن يكون رقماً إيجابياً"),
    paymentMethod: z.string().optional(),
  }),
});
