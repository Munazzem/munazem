import mongoose, { Schema, Model } from 'mongoose';

export interface IActivityLog {
    event:     string;
    tenantId:  mongoose.Types.ObjectId;
    userId:    mongoose.Types.ObjectId;
    targetId?: string;
    meta?:     Record<string, unknown>;
    createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>({
    event:     { type: String, required: true, index: true },
    tenantId:  { type: Schema.Types.ObjectId, required: true },
    userId:    { type: Schema.Types.ObjectId, required: true },
    targetId:  { type: String },
    meta:      { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
}, {
    timestamps: false,
    collection: 'activity_logs',
});

// Auto-delete after 90 days — keeps storage lean
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Fast queries for admin dashboard
activityLogSchema.index({ tenantId: 1, createdAt: -1 });
activityLogSchema.index({ event: 1, createdAt: -1 });

export const ActivityLogModel: Model<IActivityLog> =
    mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
