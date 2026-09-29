import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterAttendanceDocument } from '../../types/center.types.js';
import { AttendanceStatus } from '../../common/enums/enum.service.js';

/**
 * CenterAttendance — Quick Attendance system (no sessions required).
 * Select group → select date → mark students → save.
 * Also supports QR scan for automatic check-in.
 */
const centerAttendanceSchema = new Schema<ICenterAttendanceDocument>({
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        required: true,
        index: true,
    },
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterGroup',
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
    status: {
        type: String,
        enum: Object.values(AttendanceStatus),
        required: true,
    },
    // How the attendance was recorded
    source: {
        type: String,
        enum: ['MANUAL', 'QR_SCAN'],
        default: 'MANUAL',
    },
    scannedAt: { type: Date, default: Date.now },
    recordedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',  // the owner or supervisor who recorded
    },
    notes: { type: String },
}, { timestamps: true });

// Unique: one attendance record per student per group per day
centerAttendanceSchema.index(
    { groupId: 1, studentId: 1, date: 1 },
    { unique: true }
);

// Fast: all attendance for a group on a specific date
centerAttendanceSchema.index({ groupId: 1, date: 1 });

// Fast: attendance history for a specific student
centerAttendanceSchema.index({ studentId: 1, date: -1 });

// Fast: all attendance for a center on a date (dashboard)
centerAttendanceSchema.index({ centerId: 1, date: 1 });

export const CenterAttendanceModel: Model<ICenterAttendanceDocument> =
    mongoose.models.CenterAttendance || mongoose.model<ICenterAttendanceDocument>('CenterAttendance', centerAttendanceSchema);
