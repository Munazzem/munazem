import { z } from 'zod';

export const createNotebookSchema = z.object({
  body: z.object({
    name:        z.string().min(1, 'اسم المذكرة مطلوب').max(200),
    gradeLevel:  z.string().min(1, 'المرحلة الدراسية مطلوبة'),
    price:       z.number().positive('السعر يجب أن يكون أكبر من صفر'),
    stock:       z.number().int().min(0).optional(),
    description: z.string().max(500).optional(),
  }),
});

export const updateNotebookSchema = z.object({
  body: z.object({
    name:        z.string().min(1).max(200).optional(),
    gradeLevel:  z.string().optional(),
    price:       z.number().positive().optional(),
    description: z.string().max(500).optional(),
  }),
});

export const restockNotebookSchema = z.object({
  body: z.object({
    quantity: z.number().int().positive('الكمية يجب أن تكون أكبر من صفر'),
  }),
});
