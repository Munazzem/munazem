export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING';
export type SubscriptionPlan = 'BASIC' | 'PRO' | 'PREMIUM';
export type DurationMonths = 1 | 4 | 9 | 12;

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
    BASIC:   1000,
    PRO:     1500,
    PREMIUM: 2000,
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
    BASIC:   'الأساسية',
    PRO:     'الاحترافية',
    PREMIUM: 'المتميزة',
};

export const DURATION_LABELS: Record<DurationMonths, string> = {
    1:  'شهر واحد',
    4:  'ترم دراسي (4 أشهر)',
    9:  'ترمين دراسيين (9 أشهر)',
    12: 'سنة كاملة (12 شهر)',
};

export const DURATION_MONTHS: DurationMonths[] = [1, 4, 9, 12];

export interface IPlanDuration {
    months: number;
    label: string;
    total: number;
}

export interface IAvailablePlan {
    tier: SubscriptionPlan;
    name: string;
    pricePerMonth: number;
    durations: IPlanDuration[];
}

export interface ISubscription {
    _id: string;
    teacherId: string | {
        _id: string;
        name: string;
        email?: string;
        phone: string;
    };
    planTier: SubscriptionPlan;
    durationMonths: DurationMonths;
    startDate: string;
    endDate: string;
    amount: number;
    status: SubscriptionStatus;
    paymentMethod?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSubscriptionDTO {
    teacherId: string;
    planTier: SubscriptionPlan;
    durationMonths: DurationMonths;
    paymentMethod?: string;
}
