import { apiClient } from './axios';
import type {
    IAttendanceRecord,
    IAttendanceSnapshot,
    RecordAttendanceDTO,
    AttendanceStatus,
} from '@/types/session.types';

export const recordAttendance = async (data: RecordAttendanceDTO): Promise<IAttendanceRecord> => {
    const res = await apiClient.post('/attendance', data);
    return (res as any).data;
};

export const getSessionAttendance = async (
    sessionId: string,
    search?: string
): Promise<IAttendanceRecord[]> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiClient.get(`/attendance/session/${sessionId}${query}`);
    return (res as any).data;
};

export const updateAttendance = async (
    attendanceId: string,
    status: AttendanceStatus,
    notes?: string
): Promise<IAttendanceRecord> => {
    const res = await apiClient.patch(`/attendance/${attendanceId}`, { status, notes });
    return (res as any).data;
};

export const completeSession = async (sessionId: string): Promise<{
    session: { _id: string; status: string };
    snapshot: IAttendanceSnapshot;
}> => {
    const res = await apiClient.post(`/attendance/session/${sessionId}/complete`);
    return (res as any).data;
};

export const getSessionSnapshot = async (sessionId: string): Promise<IAttendanceSnapshot> => {
    const res = await apiClient.get(`/attendance/snapshot/${sessionId}`);
    return (res as any).data;
};

export interface IWhatsAppLink {
    studentId: string;
    studentName: string;
    status: 'PRESENT' | 'ABSENT';
    whatsappLink: string;
}

export const getWhatsAppLinks = async (sessionId: string): Promise<IWhatsAppLink[]> => {
    const res = await apiClient.get(`/attendance/session/${sessionId}/whatsapp-links`);
    return (res as any).data;
};

export const getGroupAttendanceHistory = async (
    groupId: string,
    params?: { page?: number; limit?: number }
): Promise<{
    data: IAttendanceSnapshot[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    const res = await apiClient.get(`/attendance/history/${groupId}?${query.toString()}`);
    return (res as any).data;
};
