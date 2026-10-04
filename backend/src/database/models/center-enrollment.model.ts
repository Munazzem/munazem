import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterEnrollmentDocument } from '../../types/center.types.js';
import { CenterEnrollmentType } from '../../common/enums/enum.service.js';

/**
 * CenterEnrollment — Links a student to a package, private teachers, or both.
 * One enrollment per student per center (unique constraint).
 * Stores pricing snapshots and discount information.
 */
const discountSchema = new Schema({
    type:  { type: String, enum: ['PERCENTAGE', 'FIXED'], default: null },
    value: { type: Number, default: 0 },
}, { _id: false });

const privateTeacherSchema = new Schema({
    centerTeacherId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterTeacher',
        required: true,
    },
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterGroup',
    },
    subject:         { type: String },
    monthlyPrice:    { type: Number, min: 0 },
    sessionsPerWeek: { type: Number, min: 1, default: 1 },
}, { _id: false });

const centerEnrollmentSchema = new Schema<ICenterEnrollmentDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterStudent',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: Object.values(CenterEnrollmentType),
        required: true,
    },

    // ── Package Fields ──────────────────────────────────────────────
    packageId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterPackage',
        default: null,
    },
    packageMonthlyPrice: { type: Number, default: null },  // price snapshot
    packageDiscount:     { type: discountSchema, default: () => ({}) },
    packageGroups: [{
        type: Schema.Types.ObjectId,
        ref: 'CenterGroup',
    }],

    // ── Private Fields ──────────────────────────────────────────────
    privateTeachers:     { type: [privateTeacherSchema], default: [] },
    privateDiscount:     { type: discountSchema, default: () => ({}) },

    // ── Combined Discount (package + private paid together) ─────────
    combinedDiscount:    { type: discountSchema, default: () => ({}) },

    isActive:  { type: Boolean, default: true },
    startDate: { type: Date, default: Date.now },
}, { timestamps: true });

// Unique: one enrollment per student per center
centerEnrollmentSchema.index({ centerId: 1, studentId: 1 }, { unique: true });

// Fast: list all students in a specific package
centerEnrollmentSchema.index({ packageId: 1, isActive: 1 });

export const CenterEnrollmentModel: Model<ICenterEnrollmentDocument> =
    mongoose.models.CenterEnrollment || mongoose.model<ICenterEnrollmentDocument>('CenterEnrollment', centerEnrollmentSchema);
