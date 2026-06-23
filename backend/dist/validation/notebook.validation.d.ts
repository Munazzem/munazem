import { z } from 'zod';
export declare const createNotebookSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        gradeLevel: z.ZodString;
        price: z.ZodNumber;
        stock: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateNotebookSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        gradeLevel: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const restockNotebookSchema: z.ZodObject<{
    body: z.ZodObject<{
        quantity: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=notebook.validation.d.ts.map