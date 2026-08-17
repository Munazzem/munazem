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
        required: true,
        min: [0, 'سعر الحصة لا يمكن أن يكون سالباً'],
    },
    fullCyclePrice: {
        type: Number,
        required: true,
        min: [0, 'سعر الدورة الكاملة لا يمكن أن يكون سالباً'],
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
        required: true,
        min: [0, 'المبلغ المطلوب لا يمكن أن يكون سالباً'],
    },
    totalPaid: {
        type: Number,
        default: 0,
        min: [0, 'إجمالي المدفوع لا يمكن أن يكون سالباً'],
    },
    remainingAmount: {
        type: Number,
        required: true,
        min: [0, 'المتبقي لا يمكن أن يكون سالباً'],
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
