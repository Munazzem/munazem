import mongoose, { Schema, Model } from 'mongoose';
import type { ICycleEnrollmentDocument } from '../../types/cycle-enrollment.types.js';
import { CycleEnrollmentStatus } from '../../common/enums/enum.service.js';

const cycleEnrollmentSchema = new Schema<ICycleEnrollmentDocument>({
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true
    },
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    cycleNumber: {
        type: Number,
        required: true
    },
    cycleCapacity: {
        type: Number,
        required: true
    },
    pricePerSession: {
        type: Number,
        required: true
    },
    fullCyclePrice: {
        type: Number,
        required: true
    },
    startSession: {
        type: Number,
        required: true
    },
    chargeableSessions: {
        type: Number,
        required: true
    },
    cycleCharge: {
        type: Number,
        required: true
    },
    totalPaid: {
        type: Number,
        default: 0
    },
    remainingAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: Object.values(CycleEnrollmentStatus),
        required: true,
        default: CycleEnrollmentStatus.UNPAID
    }
}, {
    timestamps: true
});

// Ensure a student is only enrolled once per cycle
cycleEnrollmentSchema.index({ studentId: 1, groupId: 1, cycleNumber: 1 }, { unique: true });

// For querying unpaid students for a teacher
cycleEnrollmentSchema.index({ teacherId: 1, cycleNumber: 1, status: 1 });
cycleEnrollmentSchema.index({ teacherId: 1, status: 1 });

export const CycleEnrollmentModel: Model<ICycleEnrollmentDocument> =
    mongoose.model<ICycleEnrollmentDocument>('CycleEnrollment', cycleEnrollmentSchema);
