import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';

const gradeLevelEnum = z.nativeEnum(GradeLevel, {
  error: () => ({ message: `المرحلة الدراسية غير صحيحة. يجب أن تكون إحدى القيم المحددة` })
});

export const createStudentSchema = z.object({
  body: z.object({
    fullName:     z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً"),
    studentPhone: z.string().min(10, "رقم هاتف الطالب غير صحيح"),
    parentPhone:  z.string().min(10, "رقم هاتف ولي الأمر غير صحيح"),
    gradeLevel:   gradeLevelEnum,
    groupId:      z.string().length(24, "معرف المجموعة غير صحيح"),
    barcode:      z.string().optional()
  })
});

export const bulkCreateStudentsSchema = z.object({
  body: z.object({
    students: z.array(z.object({
      fullName:     z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً"),
      studentPhone: z.string().min(10, "رقم هاتف الطالب غير صحيح"),
      parentPhone:  z.string().min(10, "رقم هاتف ولي الأمر غير صحيح"),
      gradeLevel:   gradeLevelEnum,
      groupId:      z.string().length(24, "معرف المجموعة غير صحيح"),
      barcode:      z.string().optional()
    })).min(1, "يجب إرسال طالب واحد على الأقل").max(50, "لا يمكن إضافة أكثر من 50 طالب في المرة الواحدة")
  })
});

export const updateStudentSchema = z.object({
  body: z.object({
    fullName:     z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً").optional(),
    studentPhone: z.string().min(10, "رقم هاتف الطالب غير صحيح").optional(),
    parentPhone:  z.string().min(10, "رقم هاتف ولي الأمر غير صحيح").optional(),
    gradeLevel:   gradeLevelEnum.optional(),
    groupId:      z.string().length(24, "معرف المجموعة غير صحيح").optional(),
    barcode:      z.string().optional(),
    isActive:     z.boolean().optional()
  })
});
