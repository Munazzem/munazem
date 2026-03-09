import { apiClient as api } from './axios';
import { UserResponse, UsersListResponse } from '@/types/user.types';

// apiClient interceptor returns response.data directly → shape: { status, message, data }
export const fetchUsers = async (params?: { search?: string }): Promise<UsersListResponse> => {
    const response = await api.get('/users', { params });
    return (response as any).data;
};

export const addUser = async (data: any): Promise<UserResponse> => {
    const response = await api.post('/users', data);
    return (response as any).data;
};

export const updateUser = async (params: { id: string; data: any }): Promise<UserResponse> => {
    const response = await api.put(`/users/${params.id}`, params.data);
    return (response as any).data;
};

export const deleteUser = async (id: string): Promise<UserResponse> => {
    const response = await api.delete(`/users/${id}`);
    return (response as any).data;
};

export const paySalary = async (id: string, data: { amount: number; notes?: string }): Promise<any> => {
    const response = await api.post(`/users/${id}/pay-salary`, data);
    return (response as any).data;
};
