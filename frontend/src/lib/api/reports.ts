import { apiClient } from './axios';
import type { IDailySummary, IUnpaidStudentsReport } from '@/types/report.types';

export type { IDailySummary, IUnpaidStudentsReport };

// ── Daily Summary ──────────────────────────────────────────────────

export const fetchDailySummary = async (date?: string): Promise<IDailySummary> => {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/reports/daily-summary${query}`);
    return (res as any).data;
};

export const fetchDailySummaryHtml = async (date?: string): Promise<string> => {
    const query = date ? `?date=${date}` : '';
    const res = await apiClient.get(`/reports/daily-summary/pdf${query}`);
    return res as unknown as string;
};

// ── Student Reports ────────────────────────────────────────────────

export const fetchStudentReport = async (studentId: string) => {
    const res = await apiClient.get(`/reports/student/${studentId}`);
    return (res as any).data;
};

export const fetchStudentReportHtml = async (studentId: string): Promise<string> => {
    const res = await apiClient.get(`/reports/student/${studentId}/pdf`);
    return res as unknown as string;
};

// ── Group Reports ──────────────────────────────────────────────────

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

// ── Financial Reports ──────────────────────────────────────────────

export const fetchFinancialMonthlyReport = async (year: number, month: number) => {
    const res = await apiClient.get(`/reports/financial/monthly?year=${year}&month=${month}`);
    return (res as any).data;
};

export const fetchMonthlyReportHtml = async (year: number, month: number): Promise<string> => {
    const res = await apiClient.get(`/reports/financial/monthly/pdf?year=${year}&month=${month}`);
    return res as unknown as string;
};

// ── Unpaid Students ────────────────────────────────────────────────

export const fetchUnpaidStudents = async (includeList = false): Promise<IUnpaidStudentsReport> => {
    const res = await apiClient.get(`/reports/unpaid-students${includeList ? '?includeList=true' : ''}`);
    return (res as any).data;
};
