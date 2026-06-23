import mongoose, { Schema, Model } from 'mongoose';
import { GradeLevel } from '../../common/enums/enum.service.js';
const priceSettingsSchema = new Schema({
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // one settings document per teacher
        index: true,
    },
    prices: [{
            gradeLevel: {
                type: String,
                enum: Object.values(GradeLevel),
                required: true,
            },
            amount: {
                type: Number,
                required: true,
                min: 0,
            },
            _id: false,
        }],
}, {
    timestamps: true,
});
export const PriceSettingsModel = mongoose.model('PriceSettings', priceSettingsSchema);
//# sourceMappingURL=price-settings.model.js.map