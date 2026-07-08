import { z } from 'zod';
import { SessionStatus } from '../common/enums/enum.service.js';
export declare const createSessionSchema: z.ZodObject<{
    body: z.ZodObject<{
        groupId: z.ZodString;
        date: z.ZodString;
        startTime: z.ZodOptional<z.ZodString>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateSessionStatusSchema: z.ZodObject<{
    body: z.ZodObject<{
        status: z.ZodEnum<typeof SessionStatus>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=session.validation.d.ts.map