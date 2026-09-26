import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterGroupDocument } from '../../types/center.types.js';
import { GradeLevel, CenterGroupType } from '../../common/enums/enum.service.js';

/**
 * CenterGroup — A group within a center, linked to a CenterTeacher (entity).
 * Separate from the existing Group model to avoid cycle/session complexity.
 * Can be PACKAGE (only package students), PRIVATE (only private), or MIXED (both).
 */
const centerGroupSchema = new Schema<ICenterGroupDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    centerTeacherId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterTeacher',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'اسم المجموعة مطلوب'],
        trim: true,
    },
    gradeLevel: {
        type: String,
        enum: Object.values(GradeLevel),
        required: [true, 'المرحلة الدراسية مطلوبة'],
    },
    groupType: {
        type: String,
        enum: Object.values(CenterGroupType),
        required: [true, 'نوع المجموعة مطلوب'],
    },
    schedule: [{
        day:  { type: String, required: true },
        time: { type: String, required: true },
        _id: false,
    }],
    capacity: { type: Number, default: 50 },
    // Monthly price for private students in this group
    // Defaults from CenterTeacher.privateMonthlyPrice if not set
    privateMonthlyPrice: {
        type: Number,
        default: null,
        min: 0,
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes
centerGroupSchema.index({ centerId: 1, isActive: 1 });
centerGroupSchema.index({ centerTeacherId: 1, isActive: 1 });
centerGroupSchema.index({ centerId: 1, gradeLevel: 1 });

export const CenterGroupModel: Model<ICenterGroupDocument> =
    mongoose.models.CenterGroup || mongoose.model<ICenterGroupDocument>('CenterGroup', centerGroupSchema);
