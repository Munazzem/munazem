import { z } from 'zod';
import { GradeLevel, QuestionType } from '../common/enums/enum.service.js';
export declare const createExamSchema: z.ZodObject<{
    body: z.ZodObject<{
        title: z.ZodString;
        date: z.ZodString;
        gradeLevel: z.ZodOptional<z.ZodEnum<typeof GradeLevel>>;
        groupIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
        passingMarks: z.ZodOptional<z.ZodNumber>;
        questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<typeof QuestionType>;
            text: z.ZodString;
            marks: z.ZodNumber;
            options: z.ZodOptional<z.ZodArray<z.ZodString>>;
            correctAnswer: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>>;
        totalMarks: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const recordResultSchema: z.ZodObject<{
    body: z.ZodObject<{
        studentId: z.ZodString;
        studentName: z.ZodOptional<z.ZodString>;
        answers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            questionId: z.ZodString;
            answer: z.ZodString;
        }, z.core.$strip>>>;
        score: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const batchResultsSchema: z.ZodObject<{
    body: z.ZodObject<{
        results: z.ZodArray<z.ZodObject<{
            studentId: z.ZodString;
            score: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=exam.validation.d.ts.map