import mongoose, { Document } from 'mongoose';
import { SubscriptionStatus, SubscriptionPlan, DurationMonths } from '../common/enums/enum.service.js';

export interface ISubscription extends Document {
    teacherId: mongoose.Types.ObjectId;
    planTier: SubscriptionPlan;
    durationMonths: DurationMonths;
    startDate: Date;
    endDate: Date;
    amount: number;
    status: SubscriptionStatus;
    paymentMethod?: string;
}
