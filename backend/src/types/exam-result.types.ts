import { Document, Types } from 'mongoose';

export interface IExamResult {
    examId:       Types.ObjectId;
    teacherId:    Types.ObjectId;
    studentId:    Types.ObjectId;
    studentName:  string;            // embedded for fast reads
    groupId:      Types.ObjectId;
    score:        number;            // الدرجة التي حصل عليها
    totalMarks:   number;            // الدرجة الكاملة للامتحان
    passingMarks: number;
    percentage:   number;            // score / totalMarks * 100
    grade:        string;            // A+ / A / B / C / D / F
    passed:       boolean;
    recordedBy:   Types.ObjectId;    // معلم أو مساعد
    date:         Date;
    createdAt?:   Date;
}

export interface IExamResultDocument extends IExamResult, Document {}
