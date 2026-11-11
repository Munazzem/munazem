import { z } from 'zod';
import { GradeLevel } from '../common/enums/enum.service.js';

const gradeLevelEnum = z.nativeEnum(GradeLevel, {
  error: () => ({
    message: `المرحلة الدراسية غير صحيحة. القيم المسموح بها: ${Object.values(GradeLevel).join(', ')}`,
  }),
});

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

// ── Create Teacher Message Schemas (Discriminated Union) ──────────────────────
const createGroupTargetSchema = z.object({
  targetType: z.literal('GROUP'),
  groupId: z.string().regex(mongoIdRegex, 'معرف المجموعة غير صالح'),
  gradeLevel: gradeLevelEnum.optional(),
  title: z
    .string()
    .trim()
    .max(80, 'عنوان الرسالة يجب ألا يتجاوز 80 حرفاً')
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, 'نص الرسالة مطلوب')
    .max(1000, 'نص الرسالة يجب ألا يتجاوز 1000 حرف'),
  clientRequestId: z.string().trim().min(1, 'معرف الطلب clientRequestId مطلوب'),
});

const createGradeTargetSchema = z.object({
  targetType: z.literal('GRADE'),
  groupId: z.string().optional(),
  gradeLevel: gradeLevelEnum,
  title: z
    .string()
    .trim()
    .max(80, 'عنوان الرسالة يجب ألا يتجاوز 80 حرفاً')
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, 'نص الرسالة مطلوب')
    .max(1000, 'نص الرسالة يجب ألا يتجاوز 1000 حرف'),
  clientRequestId: z.string().trim().min(1, 'معرف الطلب clientRequestId مطلوب'),
});

export const createTeacherMessageSchema = z.object({
  body: z.discriminatedUnion('targetType', [
    createGroupTargetSchema,
    createGradeTargetSchema,
  ]),
});

// ── Audience Query Schemas (Discriminated Union) ──────────────────────────────
const groupAudienceQuery = z.object({
  targetType: z.literal('GROUP'),
  groupId: z.string().regex(mongoIdRegex, 'معرف المجموعة غير صالح'),
  gradeLevel: z.string().optional(),
});

const gradeAudienceQuery = z.object({
  targetType: z.literal('GRADE'),
  groupId: z.string().optional(),
  gradeLevel: gradeLevelEnum,
});

export const teacherMessageAudienceSchema = z.object({
  query: z.discriminatedUnion('targetType', [
    groupAudienceQuery,
    gradeAudienceQuery,
  ]),
});

// ── History Query Schema ──────────────────────────────────────────────────────
export const getTeacherMessagesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  }),
});
