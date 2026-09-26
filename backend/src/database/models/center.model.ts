import mongoose, { Schema, Model } from 'mongoose';
import type { ICenterDocument } from '../../types/center.types.js';

const centerSchema = new Schema<ICenterDocument>({
    // ── Identity ────────────────────────────────────────────────────
    name: {
        type: String,
        required: [true, 'اسم السنتر مطلوب'],
        trim: true,
    },
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },

    // ── Branding ────────────────────────────────────────────────────
    logoUrl: { type: String, default: null },
    phone:   { type: String, default: null },
    address: { type: String, trim: true, default: null },

    // ── Branch System ───────────────────────────────────────────────
    // null = this is the main center; ObjectId = this is a branch of another center
    parentCenterId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        default: null,
        index: true,
    },

    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Indexes
centerSchema.index({ ownerId: 1 });
centerSchema.index({ parentCenterId: 1 });

export const CenterModel: Model<ICenterDocument> =
    mongoose.models.Center || mongoose.model<ICenterDocument>('Center', centerSchema);
