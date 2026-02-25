import { z } from 'zod';
import { UserRole } from '../../common/enums/enum.service.js';

export const loginSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'رقم الهاتف غير صحيح'), 
    password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  }),
});

export const signupSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'الاسم يجب أن يكون 3 أحرف على الأقل'),
    email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
    phone: z.string().min(10, 'رقم الهاتف غير صحيح'),
    password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
    role: z.nativeEnum(UserRole).optional(),
  }),
});
