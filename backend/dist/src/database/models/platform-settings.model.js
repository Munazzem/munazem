import mongoose, { Schema, Model } from 'mongoose';
const platformSettingsSchema = new Schema({
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
export const PlatformSettingsModel = mongoose.models.PlatformSettings || mongoose.model('PlatformSettings', platformSettingsSchema);
//# sourceMappingURL=platform-settings.model.js.map