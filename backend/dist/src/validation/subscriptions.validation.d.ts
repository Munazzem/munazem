import { z } from 'zod';
export declare const createSubscriptionSchema: z.ZodObject<{
    body: z.ZodObject<{
        teacherId: z.ZodString;
        planTier: z.ZodEnum<{
            MINI: "MINI";
            BASIC: "BASIC";
            PREMIUM: "PREMIUM";
        }>;
        durationMonths: z.ZodOptional<z.ZodNumber>;
        isFreeTrial: z.ZodOptional<z.ZodBoolean>;
        studentsCount: z.ZodOptional<z.ZodNumber>;
        paymentMethod: z.ZodOptional<z.ZodString>;
        promoCode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=subscriptions.validation.d.ts.map