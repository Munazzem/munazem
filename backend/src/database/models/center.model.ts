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

    // ── Smart Card Template & Design ─────────────────────────────────
    cardTemplate: {
        frontDesignUrl:       { type: String, default: null },
        backDesignUrl:        { type: String, default: null },
        frontImageUrl:        { type: String, default: null },
        backImageUrl:         { type: String, default: null },
        themePreset:          { type: String, default: 'emerald' },
        showCenterName:       { type: Boolean, default: true },
        showCenterLogo:       { type: Boolean, default: true },
        showStudentPhoto:     { type: Boolean, default: true },
        showStudentName:      { type: Boolean, default: true },
        showBarcode:          { type: Boolean, default: true },
        showQrCode:           { type: Boolean, default: true },
        showInstructions:     { type: Boolean, default: false },
        primaryColor:         { type: String, default: '#059669' },
        showMonazemLogo:      { type: Boolean, default: true },
        monazemLogoPosition:  { type: String, default: 'top-left' },
        monazemLogoSide:      { type: String, default: 'front' },
        monazemLogoSize:      { type: String, default: 'md' },
        qrX:                  { type: Number, default: 50 },
        qrY:                  { type: Number, default: 70 },
        qrSize:               { type: Number, default: 25 },
        showQrBg:             { type: Boolean, default: true },
        showCardNumber:       { type: Boolean, default: true },
    },

    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const CenterModel: Model<ICenterDocument> =
    mongoose.models.Center || mongoose.model<ICenterDocument>('Center', centerSchema);
