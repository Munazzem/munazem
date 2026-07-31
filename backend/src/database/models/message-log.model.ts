import mongoose, { Schema, Model } from 'mongoose';

// ─── Message Log Model ───────────────────────────────────────────────────────
// Persistent record of every WhatsApp message sent/attempted by the platform.
// Unlike BullMQ jobs (which are ephemeral), this collection is the permanent
// source of truth for message history, analytics, and admin dashboards.

export interface IMessageLog extends mongoose.Document {
    teacherId: mongoose.Types.ObjectId;
    studentId?: mongoose.Types.ObjectId | undefined;
    parentPhone: string;
    kind: string;
    status: 'queued' | 'processing' | 'sent' | 'failed' | 'not_registered' | 'blocked';
    failReason?: string | undefined;
    attempts: number;
    sentAt?: Date | undefined;
    jobId?: string | undefined;
    templateIdx?: number | undefined;
    createdAt: Date;
    updatedAt: Date;
}

const messageLogSchema = new Schema<IMessageLog>({
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
    parentPhone: { type: String, required: true },
    kind: { type: String, required: true, enum: ['session_absent', 'exam_result'] },
    status: { type: String, enum: ['queued', 'processing', 'sent', 'failed', 'not_registered', 'blocked'], default: 'queued' },
    failReason: { type: String },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date },
    jobId: { type: String, index: true },
    templateIdx: { type: Number },
}, {
    timestamps: true,
});

// ── Indexes for Admin Dashboard queries ──────────────────────────────────────

// Message history: all messages for a teacher, newest first
messageLogSchema.index({ teacherId: 1, createdAt: -1 });

// Filtering by kind + date
messageLogSchema.index({ teacherId: 1, kind: 1, createdAt: -1 });

// Dashboard stats: count by status
messageLogSchema.index({ status: 1, createdAt: -1 });

// Teacher stats: messages per teacher with status filter
messageLogSchema.index({ teacherId: 1, status: 1, createdAt: -1 });

// Phone-based lookup (for admin search)
messageLogSchema.index({ parentPhone: 1, teacherId: 1 });

// ── TTL Index (Auto-Deletion) ────────────────────────────────────────────────
// Automatically delete documents that are older than 14 days to save DB costs.
messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const MessageLogModel = mongoose.models.MessageLog as mongoose.Model<IMessageLog> || 
    mongoose.model<IMessageLog>('MessageLog', messageLogSchema);
