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

export const downloadStudentReportPdf = async (studentId: string): Promise<Blob> => {
    const res = await apiClient.get(`/reports/student/${studentId}/pdf`, {
        responseType: 'blob',
    });
    return res as unknown as Blob;
};

export const fetchGroupReport = async (groupId: string) => {
    const res = await apiClient.get(`/reports/group/${groupId}`);
    return (res as any).data;
};

export const downloadGroupReportPdf = async (groupId: string): Promise<Blob> => {
    const res = await apiClient.get(`/reports/group/${groupId}/pdf`, {
        responseType: 'blob',
    });
    return res as unknown as Blob;
};

export const downloadMonthlyReportPdf = async (year: number, month: number): Promise<Blob> => {
    const res = await apiClient.get(`/reports/financial/monthly/pdf?year=${year}&month=${month}`, {
        responseType: 'blob',
    });
    return res as unknown as Blob;
};
