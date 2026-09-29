import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterTeacherDocument } from '../../types/center.types.js';

/**
 * CenterTeacher — Entity (NOT a User account).
 * Represents a teacher working inside a center with just a name and subject.
 * No login, no authentication — managed entirely by the center owner.
 */
const centerTeacherSchema = new Schema<ICenterTeacherDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'اسم المدرس مطلوب'],
        trim: true,
    },
    subject: {
        type: String,
        required: [true, 'المادة مطلوبة'],
        trim: true,
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Fast: list all active teachers in a center
centerTeacherSchema.index({ centerId: 1, isActive: 1 });

export const CenterTeacherModel: Model<ICenterTeacherDocument> =
    mongoose.models.CenterTeacher || mongoose.model<ICenterTeacherDocument>('CenterTeacher', centerTeacherSchema);
