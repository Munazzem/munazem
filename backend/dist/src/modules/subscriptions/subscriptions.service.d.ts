import type { ClientSession } from 'mongoose';
import { SubscriptionPlan, type DurationMonths } from '../../common/enums/enum.service.js';
export declare class SubscriptionService {
    static createSubscription(teacherId: string, data: {
        planTier: SubscriptionPlan;
        durationMonths: DurationMonths;
        paymentMethod?: string;
        promoCode?: string;
    }, session?: ClientSession): Promise<(import("mongoose").Document<unknown, {}, import("../../types/subscription.types.js").ISubscription, {}, import("mongoose").DefaultSchemaOptions> & import("../../types/subscription.types.js").ISubscription & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | undefined>;
    static getAllSubscriptions(): Promise<(import("../../types/subscription.types.js").ISubscription & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static getTeacherSubscriptions(teacherId: string): Promise<(import("../../types/subscription.types.js").ISubscription & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static getAvailablePlans(): Promise<{
        tier: SubscriptionPlan;
        name: string;
        pricePerMonth: any;
        durations: {
            months: number;
            label: string;
            total: number;
        }[];
    }[]>;
}
//# sourceMappingURL=subscriptions.service.d.ts.map