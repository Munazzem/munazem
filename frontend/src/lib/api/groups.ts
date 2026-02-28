import { apiClient } from './axios';

export const fetchGroups = async (filters: { page?: number; limit?: number; search?: string; gradeLevel?: string } = {}) => {
    const res = await apiClient.get('/groups', { params: filters });
    return res.data;
};
