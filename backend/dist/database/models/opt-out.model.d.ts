import mongoose, { Model } from 'mongoose';
export interface IOptOut {
    phone: string;
    teacherId: mongoose.Types.ObjectId;
    createdAt?: Date;
}
export declare const OptOutModel: Model<IOptOut>;
//# sourceMappingURL=opt-out.model.d.ts.map