import mongoose, { Schema, Model } from 'mongoose';
import type { ICardTemplateDocument } from '../../types/card-template.types.js';

const cardTemplateSchema = new Schema<ICardTemplateDocument>({
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        default: 'القالب المخصص للكروت الذكية',
        trim: true
    },
    backImageUrl: {
        type: String,
        required: true
    },
    frontImageUrl: {
        type: String,
        default: null
    },
    cardWidthMm: {
        type: Number,
        default: 85.6
    },
    cardHeightMm: {
        type: Number,
        default: 53.98
    },
    qrCode: {
        xPercent: { type: Number, default: 50 },
        yPercent: { type: Number, default: 50 },
        sizePercent: { type: Number, default: 35 }
    },
    cardNumber: {
        xPercent: { type: Number, default: 50 },
        yPercent: { type: Number, default: 85 },
        fontSizePt: { type: Number, default: 11 },
        color: { type: String, default: '#000000' },
        show: { type: Boolean, default: true }
    }
}, {
    timestamps: true
});

export const CardTemplateModel: Model<ICardTemplateDocument> =
    mongoose.model<ICardTemplateDocument>('CardTemplate', cardTemplateSchema);
