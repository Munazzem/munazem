import mongoose, { Model } from 'mongoose';
/**
 * Archive model for old attendance records (> 6 months).
 * Same schema as AttendanceModel — stored in a separate collection
 * to keep the active collection lean and fast.
 *
 * Auto-deleted after 24 months via TTL index.
 */
interface IArchiveAttendance {
    studentId: mongoose.Types.ObjectId;
    sessionId?: mongoose.Types.ObjectId;
    type: string;
    status: string;
    isGuest: boolean;
    scannedAt: Date;
    scannedBy?: mongoose.Types.ObjectId;
    notes?: string;
    archivedAt: Date;
}
export declare const ArchiveAttendanceModel: Model<IArchiveAttendance>;
export {};
//# sourceMappingURL=archive-attendance.model.d.ts.map