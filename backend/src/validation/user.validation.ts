import { z } from 'zod';

// Base User validations
export const userCreationSchema = z.object({
  body: z.object({
    name:     z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
    phone:    z.string().min(10, "رقم الهاتف غير صحيح"),
    email:    z.string().email("البريد الإلكتروني غير صحيح").optional(),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    stage:    z.string().optional(),
    salary:   z.number().min(0, "الراتب يجب أن يكون صفر أو أكثر").optional().nullable(),
  })
});

export const userUpdateSchema = z.object({
  body: z.object({
    name:     z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل").optional(),
    phone:    z.string().min(10, "رقم الهاتف غير صحيح").optional(),
    email:    z.string().email("البريد الإلكتروني غير صحيح").optional(),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").optional(),
    stage:    z.string().optional(),
    salary:   z.number().min(0).optional().nullable(),
    isActive: z.boolean().optional(),
  })
});

export const paySalarySchema = z.object({
  params: z.object({
    id: z.string().min(1, "معرف المساعد مطلوب"),
  }),
  body: z.object({
    amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    notes:  z.string().max(300).optional(),
  }),
});
