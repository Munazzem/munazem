import { apiClient } from './axios';

// GET /auth/me
export const fetchMe = async () => {
    const res = await apiClient.get('/auth/me');
    return (res as any).data;
};

// PATCH /auth/me
export const updateMe = async (data: { name?: string; email?: string; phone?: string }) => {
    const res = await apiClient.patch('/auth/me', data);
    return (res as any).data;
};

// PATCH /auth/change-password
export const changePassword = async (data: { currentPassword: string; newPassword: string }) => {
    const res = await apiClient.patch('/auth/change-password', data);
    return (res as any).data;
};
