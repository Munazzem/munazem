export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING';
export type SubscriptionPlan = 'MINI' | 'BASIC' | 'PREMIUM';
export type DurationMonths = number;

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
    MINI:    500,
    BASIC:   900,
    PREMIUM: 1200,
};

export const PLAN_CONFIG: Record<SubscriptionPlan, { baseStudents: number; extraPricePer100: number }> = {
    MINI:    { baseStudents: 250, extraPricePer100: 250 },
    BASIC:   { baseStudents: 500, extraPricePer100: 200 },
    PREMIUM: { baseStudents: 500, extraPricePer100: 200 },
};

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
    MINI:    'المصغرة',
    BASIC:   'الأساسية',
    PREMIUM: 'المتميزة',
};

export const DURATION_LABELS: Record<number, string> = {
    1:  'شهر واحد',
    4:  'ترم دراسي (4 أشهر)',
    9:  'ترمين دراسيين (9 أشهر)',
    12: 'سنة كاملة (12 شهر)',
};

export const DURATION_MONTHS: number[] = [1, 4, 9, 12];

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
    studentsCount?: number;
    status: SubscriptionStatus;
    paymentMethod?: string;
    isFreeTrial?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSubscriptionDTO {
    teacherId: string;
    planTier: SubscriptionPlan;
    durationMonths: DurationMonths;
    isFreeTrial?: boolean;
    studentsCount?: number;
    paymentMethod?: string;
}
