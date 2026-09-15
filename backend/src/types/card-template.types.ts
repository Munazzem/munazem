import { Document, Types } from 'mongoose';

export interface ICardTemplate {
    teacherId: Types.ObjectId;
    name: string;
    backImageUrl: string;
    frontImageUrl?: string;
    cardWidthMm: number;
    cardHeightMm: number;
    qrCode: {
        xPercent: number;     // 0 - 100% from left
        yPercent: number;     // 0 - 100% from top
        sizePercent: number;  // 10 - 50% relative to card width
    };
    cardNumber: {
        xPercent: number;
        yPercent: number;
        fontSizePt: number;
        color: string;
        show: boolean;
    };
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICardTemplateDocument extends ICardTemplate, Document {}

export interface UpdateCardTemplateDTO {
    name?: string;
    backImageUrl?: string;
    frontImageUrl?: string;
    qrCode?: {
        xPercent: number;
        yPercent: number;
        sizePercent: number;
    };
    cardNumber?: {
        xPercent: number;
        yPercent: number;
        fontSizePt: number;
        color: string;
        show: boolean;
    };
}
