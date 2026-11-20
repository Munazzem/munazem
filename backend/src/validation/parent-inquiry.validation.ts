import { z } from 'zod';
import { INQUIRY_CATEGORIES, MAX_INQUIRY_EDITS } from '../types/parent-inquiry.types.js';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

const objectIdSchema = z
  .string()
  .trim()
  .regex(mongoIdRegex, 'معرف غير صالح');

const inquiryCategorySchema = z.enum(
  INQUIRY_CATEGORIES as unknown as [string, ...string[]],
  {
    error: () => ({
      message: `تصنيف الطلب غير صالح. القيم المسموح بها: ${INQUIRY_CATEGORIES.join(', ')}`,
    }),
  }
);

// ── Parent Endpoints Schemas ──────────────────────────────────────────────────

export const createParentInquirySchema = z.object({
  body: z.object({
    studentId: objectIdSchema,
    category: inquiryCategorySchema,
    body: z
      .string()
      .trim()
      .min(1, 'نص الرسالة مطلوب ولا يمكن أن يكون فارغاً')
      .max(1000, 'نص الرسالة يجب ألا يتجاوز 1000 حرف'),
    clientRequestId: z
      .string()
      .trim()
      .min(1, 'معرف الطلب clientRequestId مطلوب')
      .max(64, 'معرف الطلب يجب ألا يتجاوز 64 حرفاً'),
  }),
});

export const getParentInquiriesSchema = z.object({
  query: z.object({
    studentId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  }),
});

export const parentInquiryIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const updateParentInquirySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    body: z
      .string()
      .trim()
      .min(1, 'نص الرسالة مطلوب ولا يمكن أن يكون فارغاً')
      .max(1000, 'نص الرسالة يجب ألا يتجاوز 1000 حرف'),
  }),
});

// ── Staff (Teacher / Assistant) Endpoints Schemas ─────────────────────────────

export const getStaffInquiriesSchema = z.object({
  query: z.object({
    box: z.enum(['assistant', 'teacher', 'all']).optional().default('all'),
    state: z.enum(['open', 'replied', 'cancelled', 'all']).optional().default('open'),
    category: inquiryCategorySchema.optional(),
    studentId: objectIdSchema.optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  }),
});

export const staffInquiryIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const replyInquirySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z.object({
    body: z
      .string()
      .trim()
      .min(1, 'نص الرد مطلوب ولا يمكن أن يكون فارغاً')
      .max(2000, 'نص الرد يجب ألا يتجاوز 2000 حرف'),
    clientRequestId: z
      .string()
      .trim()
      .min(1, 'معرف الطلب clientRequestId مطلوب')
      .max(64, 'معرف الطلب يجب ألا يتجاوز 64 حرفاً'),
    expectedEditCount: z
      .number()
      .int()
      .min(0)
      .max(MAX_INQUIRY_EDITS)
      .optional(),
  }),
});

export const escalateInquirySchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      note: z
        .string()
        .trim()
        .max(300, 'ملاحظة التحويل يجب ألا تتجاوز 300 حرف')
        .optional(),
    })
    .optional()
    .default({}),
});
