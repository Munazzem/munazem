import mongoose, { Schema, Model } from 'mongoose';
import type { IExamDocument } from '../../types/exam.types.js';
import { QuestionType, ExamStatus, ExamSource, GradeLevel } from '../../common/enums/enum.service.js';

const questionSchema = new Schema({
    type:   { type: String, enum: Object.values(QuestionType), required: true },
    text:   { type: String, required: true },
    marks:  { type: Number, required: true, min: 0 },
    // MCQ options
    options: [{ type: String }],
    // MCQ + TRUE_FALSE correct answer
    correctAnswer: { type: String },
}, { _id: false });

const examSchema = new Schema<IExamDocument>({
    teacherId: {
        type: Schema.Types.ObjectId, ref: 'User', required: true, index: true,
    },
    title:      { type: String, required: [true, 'عنوان الامتحان مطلوب'], trim: true },
    gradeLevel: { type: String, enum: Object.values(GradeLevel) },
    groupIds:   [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    date:       { type: Date, required: true },
    totalMarks: {
        type: Number, required: true, min: [1, 'الدرجة الكاملة يجب أن تكون أكبر من صفر'],
    },
    passingMarks: {
        type: Number, required: true, min: [0, 'درجة النجاح لا يمكن أن تكون سالبة'],
    },
    questions: { type: [questionSchema], default: [] },
    status:    { type: String, enum: Object.values(ExamStatus), default: ExamStatus.DRAFT },
    source:    { type: String, enum: Object.values(ExamSource), default: ExamSource.MANUAL },
}, {
    timestamps: true,
});

// Fast queries: teacher's exams by grade or status
examSchema.index({ teacherId: 1, date: -1 });
examSchema.index({ teacherId: 1, gradeLevel: 1, status: 1 });

export const ExamModel: Model<IExamDocument> =
    mongoose.model<IExamDocument>('Exam', examSchema);
