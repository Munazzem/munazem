import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterPackageDocument } from '../../types/center.types.js';
import { GradeLevel } from '../../common/enums/enum.service.js';

/**
 * CenterPackage — A bundle of teachers/subjects at a single monthly price.
 * One package per grade level per center.
 */
const centerPackageSchema = new Schema<ICenterPackageDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'اسم الباكيدج مطلوب'],
        trim: true,
    },
    gradeLevel: {
        type: String,
        enum: Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'],
    },
    // Teachers participating in this package (denormalized subject for fast reads)
    teachers: [{
        teacherId: {
            type: Schema.Types.ObjectId,
            ref: 'CenterTeacher',
            required: true,
        },
        subject: { type: String },
        _id: false,
    }],
    // Fixed monthly price for the entire package
    monthlyPrice: {
        type: Number,
        required: [true, 'سعر الباكيدج مطلوب'],
        min: [1, 'سعر الباكيدج يجب أن يكون أكبر من صفر'],
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Unique: one package per grade level per center
centerPackageSchema.index({ centerId: 1, gradeLevel: 1 }, { unique: true });

export const CenterPackageModel: Model<ICenterPackageDocument> =
    mongoose.models.CenterPackage || mongoose.model<ICenterPackageDocument>('CenterPackage', centerPackageSchema);
