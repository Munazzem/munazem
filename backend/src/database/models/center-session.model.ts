import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterSessionDocument } from '../../types/center.types.js';
import { GradeLevel, AttendanceStatus } from '../../common/enums/enum.service.js';

const snapshotStudentSchema = new Schema(
    {
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'CenterStudent',
            required: true,
        },
        studentName: { type: String, required: true },
        studentCode: { type: String, default: '' },
        studentPhone: { type: String, default: null },
        parentPhone: { type: String, default: null },
        status: {
            type: String,
            enum: Object.values(AttendanceStatus),
            required: true,
        },
        scannedAt: { type: Date, default: null },
        source: { type: String, default: 'MANUAL' },
        notes: { type: String, default: '' },
    },
    { _id: false }
);

const centerSessionSchema = new Schema<ICenterSessionDocument>(
    {
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
        centerTeacherId: {
            type: Schema.Types.ObjectId,
            ref: 'CenterTeacher',
            required: true,
        },
        gradeLevel: {
            type: String,
            enum: Object.values(GradeLevel),
            required: true,
            index: true,
        },
        subject: {
            type: String,
            default: '',
        },
        sessionDate: {
            type: Date,
            required: true,
            index: true,
        },
        scheduledDay: {
            type: String,
            default: '',
        },
        scheduledTime: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
            default: 'SCHEDULED',
            index: true,
        },
        presentCount: { type: Number, default: 0 },
        absentCount: { type: Number, default: 0 },
        lateCount: { type: Number, default: 0 },
        excusedCount: { type: Number, default: 0 },
        totalEnrolled: { type: Number, default: 0 },
        presentStudents: {
            type: [snapshotStudentSchema],
            default: [],
        },
        absentStudents: {
            type: [snapshotStudentSchema],
            default: [],
        },
        completedAt: { type: Date, default: null },
        completedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        notificationsSentAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Unique: one session per group/class per day
centerSessionSchema.index({ centerId: 1, groupId: 1, sessionDate: 1 }, { unique: true });
centerSessionSchema.index({ centerId: 1, sessionDate: -1, gradeLevel: 1 });
centerSessionSchema.index({ 'presentStudents.studentId': 1, sessionDate: -1 });
centerSessionSchema.index({ 'absentStudents.studentId': 1, sessionDate: -1 });

export const CenterSessionModel: Model<ICenterSessionDocument> =
    mongoose.models.CenterSession ||
    mongoose.model<ICenterSessionDocument>('CenterSession', centerSessionSchema);
