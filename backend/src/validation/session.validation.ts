import { z } from 'zod';
import { SessionStatus } from '../common/enums/enum.service.js';

export const createSessionSchema = z.object({
  body: z.object({
    groupId:   z.string().min(1, 'معرف المجموعة مطلوب'),
    date:      z.string().min(1, 'تاريخ الحصة مطلوب'),
    startTime: z.string().optional(),
    notes:     z.string().max(500).optional(),
  }),
});

export const updateSessionStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(SessionStatus, { error: () => ({ message: 'حالة الحصة غير صحيحة' }) }),
  }),
});
