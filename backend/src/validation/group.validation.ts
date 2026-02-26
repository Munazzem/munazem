import { z } from 'zod';

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, "اسم المجموعة مطلوب ولابد أن يكون حرفين على الأقل"),
    gradeLevel: z.string().min(2, "المرحلة الدراسية مطلوبة"),
    capacity: z.number().int().positive("الحد الأقصى يجب أن يكون رقماً صحيحاً وموجباً").optional(),
    schedule: z.array(z.object({
      day: z.string().min(1, "اليوم مطلوب"),
      time: z.string().min(1, "الوقت مطلوب"),
    })).min(1, "يجب تحديد يوم وموعد واحد على الأقل للمجموعة"),
  })
});

export const updateGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, "اسم المجموعة مطلوب ولابد أن يكون حرفين على الأقل").optional(),
    gradeLevel: z.string().min(2, "المرحلة الدراسية مطلوبة").optional(),
    capacity: z.number().int().positive("الحد الأقصى يجب أن يكون رقماً صحيحاً وموجباً").optional(),
    schedule: z.array(z.object({
      day: z.string().min(1, "اليوم مطلوب"),
      time: z.string().min(1, "الوقت مطلوب"),
    })).optional(),
    isActive: z.boolean().optional(),
  })
});
