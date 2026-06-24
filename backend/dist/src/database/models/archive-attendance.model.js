import mongoose, { Schema, Model } from 'mongoose';
import { AttendanceStatus } from '../../common/enums/enum.service.js';
const archiveAttendanceSchema = new Schema({
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    type: { type: String, enum: ['SESSION', 'MANUAL'], default: 'SESSION', required: true },
    status: { type: String, enum: Object.values(AttendanceStatus), required: true },
    isGuest: { type: Boolean, default: false },
    scannedAt: { type: Date, default: Date.now },
    scannedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    // Track when this record was archived
    archivedAt: { type: Date, default: Date.now },
}, {
    timestamps: true,
    collection: 'archive_attendance',
});
// Auto-delete after 24 months from archival date
archiveAttendanceSchema.index({ archivedAt: 1 }, { expireAfterSeconds: 24 * 30 * 24 * 60 * 60 });
// Query by teacher (via session lookup) and date
archiveAttendanceSchema.index({ sessionId: 1 });
archiveAttendanceSchema.index({ studentId: 1, scannedAt: -1 });
export const ArchiveAttendanceModel = mongoose.models.ArchiveAttendance || mongoose.model('ArchiveAttendance', archiveAttendanceSchema);
//# sourceMappingURL=archive-attendance.model.js.map