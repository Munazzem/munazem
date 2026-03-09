import mongoose, { Schema, Model } from 'mongoose';
import type { IExamResultDocument } from '../../types/exam-result.types.js';

const examResultSchema = new Schema<IExamResultDocument>({
    examId:     { type: Schema.Types.ObjectId, ref: 'Exam',    required: true },
    teacherId:  { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    studentId:  { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName:{ type: String, required: true },  // embedded — no populate
    groupId:    { type: Schema.Types.ObjectId, ref: 'Group',   required: true },
    score:      { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, required: true },
    passingMarks:{ type: Number, required: true },
    percentage: { type: Number, required: true },
    grade:      { type: String, required: true },  // A+ / A / B / C / D / F
    passed:     { type: Boolean, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date:       { type: Date, required: true },
}, {
    timestamps: true,
});

// Prevent duplicate result for same student in same exam
examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });

// Fast lookup: student's full exam history
examResultSchema.index({ teacherId: 1, studentId: 1, date: -1 });

export const ExamResultModel: Model<IExamResultDocument> =
    mongoose.model<IExamResultDocument>('ExamResult', examResultSchema);
