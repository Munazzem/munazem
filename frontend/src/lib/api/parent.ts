import { apiClient as api } from './axios';

export const parentLookup = async (parentPhone: string): Promise<any> => {
    const response = await api.post('/parent/lookup', { parentPhone });
    return (response as any).data;
};
