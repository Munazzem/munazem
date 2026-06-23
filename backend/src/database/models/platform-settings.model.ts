import mongoose, { Schema, Model } from 'mongoose';
import type { IPlatformSettingsDocument } from '../../types/platform-settings.types.js';

const platformSettingsSchema = new Schema<IPlatformSettingsDocument>({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    value: {
        type: Schema.Types.Mixed,
        required: true,
    },
}, {
    timestamps: true,
});

export const PlatformSettingsModel: Model<IPlatformSettingsDocument> =
    mongoose.models.PlatformSettings || mongoose.model<IPlatformSettingsDocument>('PlatformSettings', platformSettingsSchema);
