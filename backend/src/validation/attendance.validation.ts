import { z } from 'zod';
import { AttendanceStatus } from '../common/enums/enum.service.js';

const objectId = z.string().length(24, 'معرف غير صحيح');

export const recordAttendanceSchema = z.object({
  body: z.object({
    sessionId:  objectId,
    studentId:  objectId.optional(),
    barcode:    z.string().optional(),
    studentCode: z.string().optional(),
    status:     z.nativeEnum(AttendanceStatus).optional(),
    isGuest:    z.boolean().optional(),
    notes:      z.string().max(300).optional(),
  }).refine(
    d => d.studentId || d.barcode || d.studentCode,
    { message: 'يجب تحديد الطالب بالمعرف أو الباركود أو كود الطالب' }
  ),
});

export const batchRecordAttendanceSchema = z.object({
  body: z.object({
    sessionId:   objectId,
    studentIds:  z.array(objectId).min(1, 'يجب تحديد طالب واحد على الأقل'),
    status:      z.nativeEnum(AttendanceStatus).optional(),
  }),
});

export const updateAttendanceSchema = z.object({
  body: z.object({
    status: z.nativeEnum(AttendanceStatus, { error: () => ({ message: 'حالة الحضور غير صحيحة' }) }),
    notes:  z.string().max(300).optional(),
  }),
});
