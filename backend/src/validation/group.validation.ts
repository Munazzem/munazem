import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';

const gradeLevelEnum = z.nativeEnum(GradeLevel, {
  error: () => ({ message: `المرحلة الدراسية غير صحيحة. القيم المسموح بها: ${Object.values(GradeLevel).join(', ')}` })
});

export const createGroupSchema = z.object({
  body: z.object({
    name: z.string().min(2, "اسم المجموعة مطلوب ولابد أن يكون حرفين على الأقل"),
    gradeLevel: gradeLevelEnum,
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
    gradeLevel: gradeLevelEnum.optional(),
    capacity: z.number().int().positive("الحد الأقصى يجب أن يكون رقماً صحيحاً وموجباً").optional(),
    schedule: z.array(z.object({
      day: z.string().min(1, "اليوم مطلوب"),
      time: z.string().min(1, "الوقت مطلوب"),
    })).optional(),
    isActive: z.boolean().optional(),
  })
});
