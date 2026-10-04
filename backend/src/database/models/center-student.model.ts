import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterStudentDocument } from '../../types/center.types.js';
import { GradeLevel } from '../../common/enums/enum.service.js';

/**
 * CenterStudent — A student registered in a center.
 * Separate from the regular Student model (which is teacher-centric).
 * No groupId or teacherId — belongs to the center directly.
 * studentCode is auto-generated and unique per center.
 */
const centerStudentSchema = new Schema<ICenterStudentDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    studentName: {
        type: String,
        required: [true, 'اسم الطالب مطلوب'],
        trim: true,
    },
    parentName: {
        type: String,
        required: false,
        default: '',
        trim: true,
    },
    studentPhone: { type: String, default: null },
    parentPhone:  { type: String, default: null },
    gradeLevel: {
        type: String,
        enum: Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'],
    },
    studentCode: {
        type: String,
        required: true,
        index: true,
    },
    barcode: {
        type: String,
        default: null,
        sparse: true,
        index: true,
    },
    notes: { type: String, default: null },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Unique: studentCode per center
centerStudentSchema.index({ centerId: 1, studentCode: 1 }, { unique: true });
// Fast: list students in a center with grade filter
centerStudentSchema.index({ centerId: 1, gradeLevel: 1, isActive: 1 });
// Fast: search by phone per center
centerStudentSchema.index(
    { centerId: 1, studentPhone: 1 },
    { sparse: true, name: 'idx_center_student_phone' }
);

export const CenterStudentModel: Model<ICenterStudentDocument> =
    mongoose.models.CenterStudent ||
    mongoose.model<ICenterStudentDocument>('CenterStudent', centerStudentSchema);
