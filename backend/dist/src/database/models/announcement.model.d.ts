import mongoose, { Document } from 'mongoose';
export interface IAnnouncement extends Document {
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success';
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AnnouncementModel: mongoose.Model<IAnnouncement, {}, {}, {}, mongoose.Document<unknown, {}, IAnnouncement, {}, mongoose.DefaultSchemaOptions> & IAnnouncement & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAnnouncement>;
//# sourceMappingURL=announcement.model.d.ts.map