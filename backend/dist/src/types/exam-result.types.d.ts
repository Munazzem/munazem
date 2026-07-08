import { Document, Types } from 'mongoose';
export interface IExamResult {
    examId: Types.ObjectId;
    teacherId: Types.ObjectId;
    studentId: Types.ObjectId;
    studentName: string;
    groupId: Types.ObjectId;
    score: number;
    totalMarks: number;
    passingMarks: number;
    percentage: number;
    grade: string;
    passed: boolean;
    recordedBy: Types.ObjectId;
    date: Date;
    createdAt?: Date;
}
export interface IExamResultDocument extends IExamResult, Document {
}
//# sourceMappingURL=exam-result.types.d.ts.map