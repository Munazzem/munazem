import mongoose, { Schema, Model } from 'mongoose';
import type { IAttendanceDocument } from '../../types/attendance.types.js';
import { AttendanceStatus } from '../../common/enums/enum.service.js';

const attendanceSchema = new Schema<IAttendanceDocument>({
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true,
    },
    sessionId: {
        type: Schema.Types.ObjectId,
        ref: 'Session',
        index: true,
    },
    type: {
        type: String,
        enum: ['SESSION', 'MANUAL'],
        default: 'SESSION',
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(AttendanceStatus),
        required: true,
    },
    isGuest: {
        // true = student attending from a different group
        type: Boolean,
        default: false,
    },
    scannedAt: {
        type: Date,
        default: Date.now,
    },
    scannedBy: {
        // The assistant who registered attendance (optional)
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    notes: {
        type: String,
    },
}, {
    timestamps: true,
});

// Critical: prevent duplicate attendance record for the same student in the same session
// We use partialFilterExpression to allow multiple MANUAL records (sessionId: null)
attendanceSchema.index(
    { studentId: 1, sessionId: 1 },
    { 
        unique: true, 
        partialFilterExpression: { sessionId: { $exists: true, $ne: null } } 
    }
);

export const AttendanceModel: Model<IAttendanceDocument> =
    mongoose.model<IAttendanceDocument>('Attendance', attendanceSchema);
