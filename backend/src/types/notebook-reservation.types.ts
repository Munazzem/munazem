import { Document, Types } from 'mongoose';

export enum ReservationStatus {
    PENDING   = 'PENDING',
    DELIVERED = 'DELIVERED',
    CANCELLED = 'CANCELLED',
}

export interface INotebookReservation {
    teacherId:     Types.ObjectId;
    studentId:     Types.ObjectId;
    notebookId:    Types.ObjectId;
    quantity:      number;
    totalPrice:    number;
    paidAmount:    number;
    status:        ReservationStatus;
    reservedAt:    Date;
    deliveredAt?:  Date;
}

export interface INotebookReservationDocument extends INotebookReservation, Document {}
