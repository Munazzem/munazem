import { z } from 'zod';
import { UserRole } from '../common/enums/enum.service.js';
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodString;
        password: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const signupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodString;
        password: z.ZodString;
        role: z.ZodOptional<z.ZodEnum<typeof UserRole>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=auth.validation.d.ts.map