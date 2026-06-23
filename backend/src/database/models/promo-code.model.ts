import mongoose, { Schema, Document } from 'mongoose';

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

const PromoCodeSchema: Schema = new Schema({
    code: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true, 
        uppercase: true 
    },
    discountPercentage: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 100 
    },
    maxUses: { 
        type: Number, 
        default: null 
    },
    usedCount: { 
        type: Number, 
        default: 0 
    },
    expiresAt: { 
        type: Date, 
        default: null 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, {
    timestamps: true
});

// Index for fast lookup by code
PromoCodeSchema.index({ code: 1 });

export const PromoCodeModel = mongoose.model<IPromoCode>('PromoCode', PromoCodeSchema);
