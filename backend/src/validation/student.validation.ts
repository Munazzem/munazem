import { z } from 'zod';

export const createStudentSchema = z.object({
  body: z.object({
    fullName: z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً"),
    studentPhone: z.string().min(10, "رقم هاتف الطالب غير صحيح"),
    parentPhone: z.string().min(10, "رقم هاتف ولي الأمر غير صحيح"),
    gradeLevel: z.string().min(2, "المرحلة الدراسية مطلوبة"),
    groupId: z.string().length(24, "معرف المجموعة غير صحيح"),
    barcode: z.string().optional()
  })
});

export const updateStudentSchema = z.object({
  body: z.object({
    fullName: z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً").optional(),
    studentPhone: z.string().min(10, "رقم هاتف الطالب غير صحيح").optional(),
    parentPhone: z.string().min(10, "رقم هاتف ولي الأمر غير صحيح").optional(),
    gradeLevel: z.string().min(2, "المرحلة الدراسية مطلوبة").optional(),
    groupId: z.string().length(24, "معرف المجموعة غير صحيح").optional(),
    barcode: z.string().optional(),
    isActive: z.boolean().optional()
  })
});
