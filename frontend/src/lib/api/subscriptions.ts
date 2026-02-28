import { apiClient } from './axios';
import type { ISubscription, IAvailablePlan, CreateSubscriptionDTO } from '@/types/subscription.types';

// apiClient interceptor returns response.data directly → shape: { status, message, data }

export const fetchSubscriptions = async (): Promise<ISubscription[]> => {
    const res = await apiClient.get('/subscriptions');
    return (res as any).data || [];
};

export const fetchTeacherSubscriptions = async (teacherId: string): Promise<ISubscription[]> => {
    const res = await apiClient.get(`/subscriptions/${teacherId}`);
    return (res as any).data || [];
};

export const fetchAvailablePlans = async (): Promise<IAvailablePlan[]> => {
    const res = await apiClient.get('/subscriptions/plans');
    return (res as any).data || [];
};

export const createSubscription = async (data: CreateSubscriptionDTO): Promise<ISubscription> => {
    const res = await apiClient.post('/subscriptions', data);
    return (res as any).data;
};
