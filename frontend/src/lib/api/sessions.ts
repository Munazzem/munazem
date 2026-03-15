import { apiClient } from './axios';
import type { CreateSessionDTO, ISession, PaginatedSessionsResponse } from '@/types/session.types';

export const fetchSessions = async (params: {
    page?: number;
    limit?: number;
    groupId?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
}): Promise<PaginatedSessionsResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.groupId) query.append('groupId', params.groupId);
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const res = await apiClient.get(`/sessions?${query.toString()}`);
    return (res as any).data;
};

export const fetchSessionById = async (sessionId: string): Promise<ISession> => {
    const res = await apiClient.get(`/sessions/${sessionId}`);
    return (res as any).data;
};

export const createSession = async (data: CreateSessionDTO): Promise<ISession> => {
    const res = await apiClient.post('/sessions', data);
    return (res as any).data;
};

export const updateSessionStatus = async (
    sessionId: string,
    status: string
): Promise<ISession> => {
    const res = await apiClient.patch(`/sessions/${sessionId}/status`, { status });
    return (res as any).data;
};

export const generateWeekSessions = async (weekStart: string): Promise<{
    weekStart: string;
    createdCount: number;
    skippedCount: number;
    message: string;
}> => {
    const res = await apiClient.post(`/sessions/generate-week?weekStart=${weekStart}`);
    return (res as any).data;
};

export const generateMonthSessions = async (year: number, month: number): Promise<{
    year: number;
    month: number;
    createdCount: number;
    skippedCount: number;
    message: string;
}> => {
    const res = await apiClient.post(`/sessions/generate-month?year=${year}&month=${month}`);
    return (res as any).data;
};
