import { QuestionType } from '../../common/enums/enum.service.js';
interface GenerateExamOptions {
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    questionTypes: QuestionType[];
    marksPerQuestion?: number;
}
export declare class AIExamService {
    static generateFromPDF(teacherId: string, pdfBuffer: Buffer, examMeta: {
        title: string;
        date: string;
        passingMarks: number;
        gradeLevel?: string;
        groupIds?: string[];
    }, options: GenerateExamOptions): Promise<{
        exam: import("mongoose").Document<unknown, {}, import("../../types/exam.types.js").IExamDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/exam.types.js").IExamDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        };
        message: string;
    }>;
}
export {};
//# sourceMappingURL=ai-exam.service.d.ts.map