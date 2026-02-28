import mongoose, { Document } from 'mongoose';
import { SubscriptionStatus } from '../common/enums/enum.service.js';

export interface ISubscription extends Document {
    teacherId: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    amount: number;
    status: SubscriptionStatus;
    paymentMethod?: string;
}
