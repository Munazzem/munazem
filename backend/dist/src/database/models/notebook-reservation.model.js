import mongoose, { Schema, Model } from 'mongoose';
import { ReservationStatus } from '../../types/notebook-reservation.types.js';
const notebookReservationSchema = new Schema({
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true,
    },
    notebookId: {
        type: Schema.Types.ObjectId,
        ref: 'Notebook',
        required: true,
        index: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    paidAmount: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: Object.values(ReservationStatus),
        default: ReservationStatus.PENDING,
        index: true,
    },
    reservedAt: {
        type: Date,
        default: Date.now,
    },
    deliveredAt: {
        type: Date,
    },
}, {
    timestamps: true,
});
export const NotebookReservationModel = mongoose.model('NotebookReservation', notebookReservationSchema);
//# sourceMappingURL=notebook-reservation.model.js.map