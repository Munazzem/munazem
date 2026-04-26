import mongoose, { Schema, Model } from 'mongoose';

export interface IErrorLog {
    level:      'warn' | 'error' | 'critical';
    message:    string;
    stack?:     string;
    requestId?: string;
    path:       string;
    method:     string;
    statusCode: number;
    userId?:    string;
    teacherId?: string;
    meta?:      Record<string, unknown>;
    createdAt:  Date;
}

const errorLogSchema = new Schema<IErrorLog>({
    level:      { type: String, enum: ['warn', 'error', 'critical'], required: true },
    message:    { type: String, required: true },
    stack:      { type: String },
    requestId:  { type: String },
    path:       { type: String, required: true },
    method:     { type: String, required: true },
    statusCode: { type: Number, required: true },
    userId:     { type: String },
    teacherId:  { type: String },
    meta:       { type: Schema.Types.Mixed },
    createdAt:  { type: Date, default: Date.now },
}, {
    // Disable auto-timestamps — we manage createdAt manually
    timestamps: false,
    collection: 'error_logs',
});

// Auto-delete logs after 30 days — keeps storage near-zero permanently
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Fast queries for admin dashboard
errorLogSchema.index({ level: 1, createdAt: -1 });
errorLogSchema.index({ teacherId: 1, createdAt: -1 });

export const ErrorLogModel: Model<IErrorLog> =
    mongoose.models.ErrorLog || mongoose.model<IErrorLog>('ErrorLog', errorLogSchema);
