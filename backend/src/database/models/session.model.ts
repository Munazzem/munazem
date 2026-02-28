import mongoose, { Schema, Model } from 'mongoose';
import type { ISessionDocument } from '../../types/session.types.js';
import { SessionStatus } from '../../common/enums/enum.service.js';

const sessionSchema = new Schema<ISessionDocument>({
    groupId: {
        type: Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true,
    },
    teacherId: {
        // Denormalized for fast queries — avoids extra join on every read
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    date: {
        type: Date,
        required: true,
    },
    startTime: {
        type: String,
        required: true,  // "10:00" in 24h format
    },
    status: {
        type: String,
        enum: Object.values(SessionStatus),
        default: SessionStatus.SCHEDULED,
    },
}, {
    timestamps: true,
});

// Compound index: fetch all sessions for a group on a specific day
sessionSchema.index({ groupId: 1, date: 1 });

// Compound index: fetch all sessions for a teacher on a specific day
sessionSchema.index({ teacherId: 1, date: 1 });

export const SessionModel: Model<ISessionDocument> =
    mongoose.model<ISessionDocument>('Session', sessionSchema);
