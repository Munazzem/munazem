import mongoose, { Schema, Model } from 'mongoose';

// ─── Opt-Out Model ───────────────────────────────────────────────────────────
// Tracks parent phone numbers that opted out of automated WhatsApp reminders.
// When a parent replies "إلغاء" or "stop", their number is saved here so
// future payment_reminder jobs skip them.

export interface IOptOut {
    phone:     string;           // normalized phone (e.g. "201012345678")
    teacherId: mongoose.Types.ObjectId;
    createdAt?: Date;
}

const optOutSchema = new Schema<IOptOut>({
    phone: {
        type:     String,
        required: true,
        index:    true,
    },
    teacherId: {
        type:     Schema.Types.ObjectId,
        ref:      'User',
        required: true,
        index:    true,
    },
}, {
    timestamps: true,
});

// One opt-out per phone per teacher
optOutSchema.index({ phone: 1, teacherId: 1 }, { unique: true });

export const OptOutModel: Model<IOptOut> =
    mongoose.model<IOptOut>('OptOut', optOutSchema);
