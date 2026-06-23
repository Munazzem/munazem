import { ExamSource } from '../../common/enums/enum.service.js';
import type { IQuestion } from '../../types/exam.types.js';
export declare class ExamsService {
    static createExam(teacherId: string, data: {
        title: string;
        gradeLevel?: string;
        groupIds?: string[];
        date: string;
        totalMarks: number;
        passingMarks: number;
        questions?: IQuestion[];
        source?: ExamSource;
    }): Promise<import("mongoose").Document<unknown, {}, import("../../types/exam.types.js").IExamDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/exam.types.js").IExamDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static getExams(teacherId: string, query?: any): Promise<{
        data: (import("../../types/exam.types.js").IExamDocument & Required<{
            _id: import("mongoose").Types.ObjectId;
        }> & {
            __v: number;
        })[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    static getExamById(examId: string, teacherId: string): Promise<import("../../types/exam.types.js").IExamDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static updateExam(examId: string, teacherId: string, data: Partial<{
        title: string;
        date: string;
        totalMarks: number;
        passingMarks: number;
        questions: IQuestion[];
        gradeLevel: string;
        groupIds: string[];
    }>): Promise<(import("../../types/exam.types.js").IExamDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static publishExam(examId: string, teacherId: string): Promise<(import("../../types/exam.types.js").IExamDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
    static deleteExam(examId: string, teacherId: string): Promise<import("../../types/exam.types.js").IExamDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static recordResult(teacherId: string, recordedBy: string, data: {
        examId: string;
        studentId: string;
        score: number;
    }): Promise<import("mongoose").Document<unknown, {}, import("../../types/exam-result.types.js").IExamResultDocument, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/exam-result.types.js").IExamResultDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }>;
    static batchRecordResults(teacherId: string, recordedBy: string, data: {
        examId: string;
        results: {
            studentId: string;
            score: number;
        }[];
    }): Promise<{
        total: number;
        inserted: number;
    }>;
    static getExamResults(examId: string, teacherId: string): Promise<{
        exam: {
            title: string;
            date: Date;
            totalMarks: number;
        };
        totalStudents: number;
        passingCount: number;
        failingCount: number;
        passRate: string;
        results: {
            parentPhone: any;
            examId: import("mongoose").Types.ObjectId;
            teacherId: import("mongoose").Types.ObjectId;
            studentId: import("mongoose").Types.ObjectId;
            studentName: string;
            groupId: import("mongoose").Types.ObjectId;
            score: number;
            totalMarks: number;
            passingMarks: number;
            percentage: number;
            grade: string;
            passed: boolean;
            recordedBy: import("mongoose").Types.ObjectId;
            date: Date;
            createdAt?: Date;
            _id: import("mongoose").Types.ObjectId;
            $locals: Record<string, unknown>;
            $op: "save" | "validate" | "remove" | null;
            $where: Record<string, unknown>;
            baseModelName?: string;
            collection: import("mongoose").Collection;
            db: import("mongoose").Connection;
            errors?: import("mongoose").Error.ValidationError;
            isNew: boolean;
            schema: import("mongoose").Schema;
            __v: number;
        }[];
    }>;
    static getStudentExamHistory(studentId: string, teacherId: string): Promise<(import("../../types/exam-result.types.js").IExamResultDocument & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
}
//# sourceMappingURL=exams.service.d.ts.map