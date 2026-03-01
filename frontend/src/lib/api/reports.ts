import { apiClient } from './axios';

export interface IDailySummary {
    date: string;
    sessionsCount: number;
    totalPresent: number;
    subscriptionsCount: number;
    financial: {
        totalIncome: number;
        totalExpenses: number;
        netBalance: number;
    };
}

export const fetchDailySummary = async (date?: string): Promise<IDailySummary> => {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/reports/daily-summary${query}`);
    return (res as any).data;
};

export const fetchStudentReport = async (studentId: string) => {
    const res = await apiClient.get(`/reports/student/${studentId}`);
    return (res as any).data;
};
