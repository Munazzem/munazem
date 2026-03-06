import { z } from 'zod';
import { AttendanceStatus } from '../common/enums/enum.service.js';

const objectId = z.string().min(1, 'معرف الطالب مطلوب');

export const recordAttendanceSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'معرف الحصة مطلوب'),
    studentId: z.string().min(1, 'معرف الطالب مطلوب'),
    status:    z.nativeEnum(AttendanceStatus).optional(),
    isGuest:   z.boolean().optional(),
    notes:     z.string().max(300).optional(),
  }),
});

export const batchRecordAttendanceSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'معرف الحصة مطلوب'),
    records: z.array(z.object({
      studentId: objectId,
      status:    z.nativeEnum(AttendanceStatus).optional(),
      isGuest:   z.boolean().optional(),
      notes:     z.string().max(300).optional(),
    })).min(1, 'يجب تحديد طالب واحد على الأقل'),
  }),
});

export const updateAttendanceSchema = z.object({
  body: z.object({
    status: z.nativeEnum(AttendanceStatus, { error: () => ({ message: 'حالة الحضور غير صحيحة' }) }),
    notes:  z.string().max(300).optional(),
  }),
});
