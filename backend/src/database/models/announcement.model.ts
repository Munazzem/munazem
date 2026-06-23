import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncement extends Document {
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success';
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const AnnouncementSchema: Schema = new Schema({
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

export const AnnouncementModel = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
