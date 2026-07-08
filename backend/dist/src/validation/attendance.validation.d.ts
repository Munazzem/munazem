import { z } from 'zod';
import { AttendanceStatus } from '../common/enums/enum.service.js';
export declare const recordAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        sessionId: z.ZodString;
        studentId: z.ZodString;
        status: z.ZodOptional<z.ZodEnum<typeof AttendanceStatus>>;
        isGuest: z.ZodOptional<z.ZodBoolean>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const batchRecordAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        sessionId: z.ZodString;
        records: z.ZodArray<z.ZodObject<{
            studentId: z.ZodString;
            status: z.ZodOptional<z.ZodEnum<typeof AttendanceStatus>>;
            isGuest: z.ZodOptional<z.ZodBoolean>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateAttendanceSchema: z.ZodObject<{
    body: z.ZodObject<{
        status: z.ZodEnum<typeof AttendanceStatus>;
        notes: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=attendance.validation.d.ts.map