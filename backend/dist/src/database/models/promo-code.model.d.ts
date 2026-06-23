import mongoose, { Document } from 'mongoose';
export interface IPromoCode extends Document {
    code: string;
    discountPercentage: number;
    maxUses?: number;
    usedCount: number;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PromoCodeModel: mongoose.Model<IPromoCode, {}, {}, {}, mongoose.Document<unknown, {}, IPromoCode, {}, mongoose.DefaultSchemaOptions> & IPromoCode & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPromoCode>;
//# sourceMappingURL=promo-code.model.d.ts.map