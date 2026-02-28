import { apiClient } from './axios';
import type { PaginatedGroupsResponse, CreateGroupDTO, UpdateGroupDTO, Group } from '@/types/group.types';

export const fetchGroups = async (filters: { page?: number; limit?: number; search?: string; gradeLevel?: string } = {}): Promise<PaginatedGroupsResponse> => {
    const res = await apiClient.get('/groups', { params: filters });
    return res.data;
};

export const fetchGroupById = async (id: string): Promise<Group> => {
    const res = await apiClient.get(`/groups/${id}`);
    return res.data?.data || res.data;
};

export const createGroup = async (data: CreateGroupDTO): Promise<Group> => {
    const res = await apiClient.post('/groups', data);
    return res.data?.data || res.data;
};

export const updateGroup = async (id: string, data: UpdateGroupDTO): Promise<Group> => {
    const res = await apiClient.put(`/groups/${id}`, data);
    return res.data?.data || res.data;
};

export const deleteGroup = async (id: string): Promise<void> => {
    await apiClient.delete(`/groups/${id}`);
};
