import { z } from 'zod';
export declare const createSubscriptionSchema: z.ZodObject<{
    body: z.ZodObject<{
        teacherId: z.ZodString;
        planTier: z.ZodEnum<{
            BASIC: "BASIC";
            PRO: "PRO";
            PREMIUM: "PREMIUM";
        }>;
        durationMonths: z.ZodUnion<readonly [z.ZodLiteral<1>, z.ZodLiteral<4>, z.ZodLiteral<9>, z.ZodLiteral<12>]>;
        paymentMethod: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=subscriptions.validation.d.ts.map