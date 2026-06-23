import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';
export declare const createStudentSchema: z.ZodObject<{
    body: z.ZodObject<{
        fullName: z.ZodString;
        studentPhone: z.ZodString;
        parentPhone: z.ZodString;
        gradeLevel: z.ZodEnum<typeof GradeLevel>;
        groupId: z.ZodString;
        barcode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const bulkCreateStudentsSchema: z.ZodObject<{
    body: z.ZodObject<{
        students: z.ZodArray<z.ZodObject<{
            fullName: z.ZodString;
            studentPhone: z.ZodString;
            parentPhone: z.ZodString;
            gradeLevel: z.ZodEnum<typeof GradeLevel>;
            groupId: z.ZodString;
            barcode: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateStudentSchema: z.ZodObject<{
    body: z.ZodObject<{
        fullName: z.ZodOptional<z.ZodString>;
        studentPhone: z.ZodOptional<z.ZodString>;
        parentPhone: z.ZodOptional<z.ZodString>;
        gradeLevel: z.ZodOptional<z.ZodEnum<typeof GradeLevel>>;
        groupId: z.ZodOptional<z.ZodString>;
        barcode: z.ZodOptional<z.ZodString>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=student.validation.d.ts.map