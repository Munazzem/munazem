export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'PENDING';

export interface ISubscription {
    _id: string;
    teacherId: string | {
        _id: string;
        name: string;
        email?: string;
        phone: string;
    };
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
    endDate: string;
    amount: number;
    paymentMethod?: string;
}
