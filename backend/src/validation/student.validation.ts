import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';

const gradeLevelEnum = z.nativeEnum(GradeLevel, {
  error: () => ({ message: `المرحلة الدراسية غير صحيحة. يجب أن تكون إحدى القيم المحددة` })
});

/** Accepts string, "", undefined, null → outputs valid Egyptian phone or undefined */
const optionalPhone = (label: string) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
    z.string().regex(/^01[0125][0-9]{8}$/, `${label} غير صحيح`).optional()
  );

export const createStudentSchema = z.object({
  body: z.object({
    fullName:     z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً"),
    studentPhone: optionalPhone("رقم هاتف الطالب"),
    parentPhone:  optionalPhone("رقم هاتف ولي الأمر"),
    gradeLevel:   gradeLevelEnum,
    groupId:      z.string().length(24, "معرف المجموعة غير صحيح"),
    barcode:      z.string().optional()
  })
});

export const bulkCreateStudentsSchema = z.object({
  body: z.object({
    students: z.array(z.object({
      fullName:     z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً"),
      studentPhone: optionalPhone("رقم هاتف الطالب"),
      parentPhone:  optionalPhone("رقم هاتف ولي الأمر"),
      gradeLevel:   gradeLevelEnum,
      groupId:      z.string().length(24, "معرف المجموعة غير صحيح"),
      barcode:      z.string().optional()
    })).min(1, "يجب إرسال طالب واحد على الأقل").max(50, "لا يمكن إضافة أكثر من 50 طالب في المرة الواحدة")
  })
});

export const updateStudentSchema = z.object({
  body: z.object({
    fullName:             z.string().min(5, "يجب إدخال اسم الطالب واسم ولي الأمر معاً").optional(),
    studentPhone:         z.preprocess(
      (val) => (val === null ? null : typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.union([z.string().regex(/^01[0125][0-9]{8}$/, "رقم هاتف الطالب غير صحيح"), z.null()]).optional()
    ),
    parentPhone:          z.preprocess(
      (val) => (val === null ? null : typeof val === 'string' && val.trim() !== '' ? val.trim() : undefined),
      z.union([z.string().regex(/^01[0125][0-9]{8}$/, "رقم هاتف ولي الأمر غير صحيح"), z.null()]).optional()
    ),
    gradeLevel:           gradeLevelEnum.optional(),
    groupId:              z.string().length(24, "معرف المجموعة غير صحيح").optional(),
    barcode:              z.string().optional(),
    isActive:             z.boolean().optional(),
    monthlySessionsQuota: z.number().int().min(1, "عدد الحصص يجب أن يكون 1 على الأقل").optional(),
    cycleCapacity:        z.number().int().min(1, "سعة الدورة يجب أن تكون 1 على الأقل").optional(),
  })
});

export const checkDuplicateStudentSchema = z.object({
  body: z.object({
    fullName:         z.string().min(2, "الاسم مطلوب"),
    studentPhone:     optionalPhone("رقم هاتف الطالب"),
    parentPhone:      optionalPhone("رقم هاتف ولي الأمر"),
    gradeLevel:       gradeLevelEnum.optional(),
    excludeStudentId: z.string().optional(),
  })
});
