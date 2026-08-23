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

export const adjustCompletedAttendanceSchema = z.object({
  params: z.object({
    sessionId: z.string().min(1, 'معرف الحصة مطلوب'),
  }),
  body: z.object({
    studentId: z.string().min(1, 'معرف الطالب مطلوب'),
    status:    z.nativeEnum(AttendanceStatus, { error: () => ({ message: 'حالة الحضور غير صحيحة' }) }),
    notes:     z.string().max(300).optional(),
  }),
});

export const syncBatchAttendanceSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'معرف الحصة مطلوب'),
    records: z.array(
      z.object({
        clientMutationId: z.string().min(1, 'معرف العملية مطلوب'),
        studentId:        objectId.optional(),
        rawToken:         z.string().min(1, 'رمز الكارت غير صحيح').optional(),
        status:           z.nativeEnum(AttendanceStatus).optional(),
        isGuest:          z.boolean().optional(),
        scannedAt:        z.string().optional(),
        notes:            z.string().max(300).optional(),
      }).refine((data) => Boolean(data.studentId || data.rawToken), {
        message: 'يجب إرسال معرف الطالب أو رمز الكارت',
      })
    ).min(1, 'يجب إرسال سجل واحد على الأقل للمزامنة'),
  }),
});

