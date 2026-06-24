import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';
export declare const createGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        gradeLevel: z.ZodEnum<typeof GradeLevel>;
        capacity: z.ZodOptional<z.ZodNumber>;
        schedule: z.ZodArray<z.ZodObject<{
            day: z.ZodString;
            time: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        gradeLevel: z.ZodOptional<z.ZodEnum<typeof GradeLevel>>;
        capacity: z.ZodOptional<z.ZodNumber>;
        schedule: z.ZodOptional<z.ZodArray<z.ZodObject<{
            day: z.ZodString;
            time: z.ZodString;
        }, z.core.$strip>>>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=group.validation.d.ts.map