import { z } from 'zod';
import { GradeLevel, SessionStatus } from '../common/enums/enum.service.js';

const objectId = z.string().length(24, 'معرف غير صحيح');

export const createSessionSchema = z.object({
  body: z.object({
    groupId:    objectId.optional(),
    title:      z.string().min(1, 'عنوان الحصة مطلوب').max(200),
    date:       z.string().min(1, 'تاريخ الحصة مطلوب'),
    gradeLevel: z.nativeEnum(GradeLevel).optional(),
    notes:      z.string().max(500).optional(),
  }),
});

export const updateSessionStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(SessionStatus, { error: () => ({ message: 'حالة الحصة غير صحيحة' }) }),
  }),
});
