import { z } from 'zod';
import { GradeLevel, QuestionType } from '../common/enums/enum.service.js';

const objectId = z.string().length(24, 'معرف غير صحيح');

const questionSchema = z.object({
  type:          z.nativeEnum(QuestionType),
  text:          z.string().min(1, 'نص السؤال مطلوب').max(1000),
  marks:         z.number().positive('درجة السؤال يجب أن تكون أكبر من صفر'),
  options:       z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
});

export const createExamSchema = z.object({
  body: z.object({
    title:        z.string().min(1, 'عنوان الامتحان مطلوب').max(200),
    date:         z.string().min(1, 'تاريخ الامتحان مطلوب'),
    gradeLevel:   z.nativeEnum(GradeLevel).optional(),
    groupIds:     z.array(objectId).optional(),
    passingMarks: z.number().positive().optional(),
    questions:    z.array(questionSchema).min(1, 'يجب إضافة سؤال واحد على الأقل'),
    totalMarks:   z.number().positive().optional(),
  }),
});

export const recordResultSchema = z.object({
  body: z.object({
    studentId:   objectId,
    studentName: z.string().min(1).optional(),
    answers:     z.array(z.object({
      questionId: z.string(),
      answer:     z.string(),
    })).optional(),
    score:       z.number().min(0).optional(),
  }),
});

export const batchResultsSchema = z.object({
  body: z.object({
    results: z.array(z.object({
      studentId: objectId,
      score:     z.number().min(0),
    })).min(1, 'يجب إدخال نتيجة طالب واحد على الأقل'),
  }),
});
