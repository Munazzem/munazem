import mongoose, { Schema, Model } from 'mongoose';

export interface IPhoneStatus extends mongoose.Document {
    teacherId: mongoose.Types.ObjectId;
    phone: string;
    status: 'valid' | 'invalid' | 'blocked';
    lastChecked: Date;
    createdAt: Date;
    updatedAt: Date;
}

const phoneStatusSchema = new Schema<IPhoneStatus>({
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ['valid', 'invalid', 'blocked'], required: true },
    lastChecked: { type: Date, default: Date.now },
}, {
    timestamps: true,
});

// Compound index to ensure uniqueness per teacher-phone pair
phoneStatusSchema.index({ teacherId: 1, phone: 1 }, { unique: true });

// Index for efficient querying by status
phoneStatusSchema.index({ status: 1, lastChecked: -1 });

// TTL index to automatically purge old phone statuses after 90 days
phoneStatusSchema.index({ lastChecked: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const PhoneStatusModel = mongoose.models.PhoneStatus as mongoose.Model<IPhoneStatus> || 
    mongoose.model<IPhoneStatus>('PhoneStatus', phoneStatusSchema);
