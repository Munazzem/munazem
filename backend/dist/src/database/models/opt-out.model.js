import mongoose, { Schema, Model } from 'mongoose';
const optOutSchema = new Schema({
    phone: {
        type: String,
        required: true,
        index: true,
    },
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
}, {
    timestamps: true,
});
// One opt-out per phone per teacher
optOutSchema.index({ phone: 1, teacherId: 1 }, { unique: true });
export const OptOutModel = mongoose.model('OptOut', optOutSchema);
//# sourceMappingURL=opt-out.model.js.map