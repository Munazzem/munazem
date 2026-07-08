import mongoose, { Schema, Document } from 'mongoose';
const AnnouncementSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'success'],
        default: 'info'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});
export const AnnouncementModel = mongoose.model('Announcement', AnnouncementSchema);
//# sourceMappingURL=announcement.model.js.map