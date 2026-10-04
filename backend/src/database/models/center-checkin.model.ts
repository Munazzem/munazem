import mongoose, { Schema, Model, Types } from 'mongoose';
import type { ICenterCheckInDocument } from '../../types/center.types.js';

/**
 * CenterCheckIn — General daily center entrance check-in.
 * Recorded once when a student enters the center gate/reception.
 * Can optionally link the specific groups/classes attended during that visit.
 */
const centerCheckInSchema = new Schema<ICenterCheckInDocument>({
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
    date: {
        type: Date,
        required: true,
    },
    checkInTime: {
        type: Date,
        default: Date.now,
    },
    source: {
        type: String,
        enum: ['QR_SCAN', 'BARCODE', 'MANUAL'],
        default: 'QR_SCAN',
    },
    attendedGroups: [{
        type: Schema.Types.ObjectId,
        ref: 'CenterGroup',
    }],
    recordedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    notes: {
        type: String,
        default: null,
    },
}, { timestamps: true });

// Ensure unique check-in per student per center per day
centerCheckInSchema.index({ centerId: 1, studentId: 1, date: 1 }, { unique: true });
centerCheckInSchema.index({ centerId: 1, date: 1, checkInTime: -1 });

export const CenterCheckInModel: Model<ICenterCheckInDocument> =
    mongoose.models.CenterCheckIn || mongoose.model<ICenterCheckInDocument>('CenterCheckIn', centerCheckInSchema);
