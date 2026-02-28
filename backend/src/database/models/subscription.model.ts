import mongoose, { Schema, Model } from 'mongoose';
import type { ISubscription } from '../../types/subscription.types.js';
import { SubscriptionStatus } from '../../common/enums/enum.service.js';

const subscriptionSchema = new Schema<ISubscription>({
    teacherId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true // [PERFORMANCE OPTIMIZATION] Added index to speed up finding all subscriptions belonging to a specific teacher
    },
    startDate: { 
        type: Date, 
        default: Date.now,
        required: true
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        enum: Object.values(SubscriptionStatus), 
        default: SubscriptionStatus.ACTIVE 
    },
    paymentMethod: { 
        type: String, 
        required: false 
    }
}, {
    timestamps: true
});

export const SubscriptionModel: Model<ISubscription> = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
