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

export const fetchStudentReportHtml = async (studentId: string): Promise<string> => {
    const res = await apiClient.get(`/reports/student/${studentId}/pdf`);
    return res as unknown as string;
};

export const fetchGroupReport = async (groupId: string) => {
    const res = await apiClient.get(`/reports/group/${groupId}`);
    return (res as any).data;
};

export const fetchGroupReportHtml = async (groupId: string): Promise<string> => {
    const res = await apiClient.get(`/reports/group/${groupId}/pdf`);
    return res as unknown as string;
};

export const fetchGroupAttendanceSheetHtml = async (groupId: string): Promise<string> => {
    const res = await apiClient.get(`/reports/group/${groupId}/attendance-sheet`);
    return res as unknown as string;
};

export const fetchFinancialMonthlyReport = async (year: number, month: number) => {
    const res = await apiClient.get(`/reports/financial/monthly?year=${year}&month=${month}`);
    return (res as any).data;
};

export const fetchMonthlyReportHtml = async (year: number, month: number): Promise<string> => {
    const res = await apiClient.get(`/reports/financial/monthly/pdf?year=${year}&month=${month}`);
    return res as unknown as string;
};
