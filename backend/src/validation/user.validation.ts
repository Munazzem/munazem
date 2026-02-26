import { z } from 'zod';

// Base User validations
export const userCreationSchema = z.object({
  body: z.object({
    name: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
    phone: z.string().min(10, "رقم الهاتف غير صحيح"),
    email: z.string().email("البريد الإلكتروني غير صحيح").optional(),
    password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
    
    // The subscription object is required ONLY if a Super Admin is creating a Teacher.
    // We make it optional here globally, but the Service layer will enforce it based on Role.
    subscription: z.object({
      amount: z.number().min(0, "القيمة لا يمكن أن تكون سالبة"),
      endDate: z.string().datetime({ message: "صيغة التاريخ غير صحيحة" }),
      paymentMethod: z.string().optional()
    }).optional()
  })
});
