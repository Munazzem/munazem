import mongoose, { Schema, Model } from 'mongoose';
import type { IAttendanceSnapshotDocument } from '../../types/attendance-snapshot.types.js';

const studentEntrySchema = new Schema({
    studentId:   { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },  // embedded — zero populate needed
    scannedAt:   { type: Date },                    // only for present/late
}, { _id: false });

const attendanceSnapshotSchema = new Schema<IAttendanceSnapshotDocument>({
    sessionId: {
        type: Schema.Types.ObjectId,
        ref: 'Session',
        required: true,
        unique: true,   // one snapshot per session
        index: true,
    },
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true,
    },
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        required: true,
    },
    // ⚡ Embedded arrays — no populate, no joins, instant reads
    presentStudents: { type: [studentEntrySchema], default: [] },
    absentStudents:  { type: [studentEntrySchema], default: [] },
    guestStudents:   { type: [studentEntrySchema], default: [] },
    // Pre-computed counters for fast dashboard stats
    presentCount: { type: Number, default: 0 },
    absentCount:  { type: Number, default: 0 },
    totalCount:   { type: Number, default: 0 },
}, {
    timestamps: true,
});

// Fast report queries: all snapshots for a group ordered by date
attendanceSnapshotSchema.index({ groupId: 1, date: -1 });

// Fast report queries: all snapshots for a teacher on a specific date
attendanceSnapshotSchema.index({ teacherId: 1, date: -1 });

export const AttendanceSnapshotModel: Model<IAttendanceSnapshotDocument> =
    mongoose.model<IAttendanceSnapshotDocument>('AttendanceSnapshot', attendanceSnapshotSchema);
