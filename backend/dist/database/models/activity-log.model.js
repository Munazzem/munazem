import mongoose, { Schema, Model } from 'mongoose';
const activityLogSchema = new Schema({
    event: { type: String, required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    targetId: { type: String },
    meta: { type: Schema.Types.Mixed },
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
export const ActivityLogModel = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
//# sourceMappingURL=activity-log.model.js.map