import mongoose, { Schema, Model } from 'mongoose';
import type { ICard } from '../../types/card.types.js';

export type CardStatus = 'NEW' | 'LINKED' | 'DISABLED';
export type CardDisabledReason = 'LOST' | 'DAMAGED' | 'MANUAL';

const cardSchema = new Schema<ICard>({
    // ── Identity ─────────────────────────────────────────────────────────────
    // cardNumber: human-readable, printed visually on the physical card
    cardNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    // cardToken: random UUID encoded inside the QR code — non-guessable
    cardToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // ── Ownership (multi-tenant) ──────────────────────────────────────────────
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        default: null,
        index: true,
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        default: null,
        index: true,
    },
    centerId: {
        type: Schema.Types.ObjectId,
        ref: 'Center',
        default: null,
        index: true,
    },
    centerStudentId: {
        type: Schema.Types.ObjectId,
        ref: 'CenterStudent',
        default: null,
        index: true,
    },

    // ── State machine: NEW → LINKED → DISABLED ────────────────────────────────
    status: {
        type: String,
        enum: ['NEW', 'LINKED', 'DISABLED'] as CardStatus[],
        default: 'NEW',
        index: true,
    },

    // ── Lifecycle metadata ────────────────────────────────────────────────────
    batchId: { type: String, index: true },   // Groups cards printed together

    linkedAt:  { type: Date, default: null },
    linkedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },

    disabledAt:     { type: Date, default: null },
    disabledReason: { type: String, default: null },  // 'LOST' | 'DAMAGED' | 'MANUAL'
    disabledBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: true,
});

// ── Compound indexes ─────────────────────────────────────────────────────────
cardSchema.index({ teacherId: 1, status: 1 });      // list all NEW/LINKED/DISABLED for a teacher
cardSchema.index({ studentId: 1, status: 1 });      // find active card(s) for a student
cardSchema.index({ teacherId: 1, batchId: 1 });     // fetch a print batch
cardSchema.index({ cardNumber: 1, teacherId: 1 });  // scan lookup scoped to teacher
cardSchema.index({ centerId: 1, status: 1 });       // list all NEW/LINKED/DISABLED for a center
cardSchema.index({ centerStudentId: 1, status: 1 });// find active card for center student
cardSchema.index({ centerId: 1, batchId: 1 });      // fetch center print batch
cardSchema.index({ cardNumber: 1, centerId: 1 });   // scan lookup scoped to center

export const CardModel: Model<ICard> = mongoose.model<ICard>('Card', cardSchema);
