import mongoose, { Document } from 'mongoose';
import { SubscriptionStatus, SubscriptionPlan } from '../common/enums/enum.service.js';
import type { DurationMonths } from '../common/enums/enum.service.js';
export interface ISubscription extends Document {
    teacherId: mongoose.Types.ObjectId;
    planTier: SubscriptionPlan;
    durationMonths: DurationMonths;
    startDate: Date;
    endDate: Date;
    amount: number;
    status: SubscriptionStatus;
    studentsCount?: number;
    paymentMethod?: string;
    promoCode?: string;
    isFreeTrial?: boolean;
}
//# sourceMappingURL=subscription.types.d.ts.map