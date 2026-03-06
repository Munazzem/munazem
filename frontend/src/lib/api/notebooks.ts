import { apiClient } from './axios';
import type {
    INotebook,
    PaginatedNotebooksResponse,
    CreateNotebookDTO,
    UpdateNotebookDTO,
} from '@/types/notebook.types';

export const fetchNotebooks = async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    gradeLevel?: string;
}): Promise<PaginatedNotebooksResponse> => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.search) query.append('search', params.search);
    if (params?.gradeLevel) query.append('gradeLevel', params.gradeLevel);
    const res = await apiClient.get(`/notebooks?${query.toString()}`);
    return (res as any).data;
};

export const createNotebook = async (data: CreateNotebookDTO): Promise<INotebook> => {
    const res = await apiClient.post('/notebooks', data);
    return (res as any).data;
};

export const updateNotebook = async (id: string, data: UpdateNotebookDTO): Promise<INotebook> => {
    const res = await apiClient.put(`/notebooks/${id}`, data);
    return (res as any).data;
};

export const restockNotebook = async (id: string, quantity: number): Promise<INotebook> => {
    const res = await apiClient.patch(`/notebooks/${id}/restock`, { quantity });
    return (res as any).data;
};

export const deleteNotebook = async (id: string): Promise<void> => {
    await apiClient.delete(`/notebooks/${id}`);
};
