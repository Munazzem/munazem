import mongoose, { Model } from 'mongoose';
export interface IActivityLog {
    event: string;
    tenantId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    targetId?: string;
    meta?: Record<string, unknown>;
    createdAt: Date;
}
export declare const ActivityLogModel: Model<IActivityLog>;
//# sourceMappingURL=activity-log.model.d.ts.map