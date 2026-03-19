import { apiClient as api } from './axios';
import { UserResponse, UsersListResponse } from '@/types/user.types';

// apiClient interceptor returns response.data directly → shape: { status, message, data }
export const fetchUsers = async (params?: { search?: string }): Promise<UsersListResponse> => {
    return api.get('/users', { params });
};

export const addUser = async (data: any): Promise<UserResponse> => {
    return api.post('/users', data);
};

export const updateUser = async (params: { id: string; data: any }): Promise<UserResponse> => {
    return api.put(`/users/${params.id}`, params.data);
};

export const deleteUser = async (id: string): Promise<UserResponse> => {
    return api.delete(`/users/${id}`);
};

export const paySalary = async (id: string, data: { amount: number; notes?: string }): Promise<any> => {
    return api.post(`/users/${id}/pay-salary`, data);
};
