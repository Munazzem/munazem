import { apiClient } from './axios';
import type {
  CreateTeacherMessageDTO,
  TeacherMessage,
  TeacherMessageAudience,
  PaginatedTeacherMessagesResponse,
  TeacherMessageTargetType,
} from '@/types/teacher-message.types';

export const fetchTeacherMessages = async (
  filters: { page?: number; limit?: number } = {}
): Promise<PaginatedTeacherMessagesResponse> => {
  const res = await apiClient.get('/teacher-messages', { params: filters });
  return (res as any).data;
};

export const fetchTeacherMessageAudience = async (params: {
  targetType: TeacherMessageTargetType;
  groupId?: string;
  gradeLevel?: string;
}): Promise<TeacherMessageAudience> => {
  const res = await apiClient.get('/teacher-messages/audience', { params });
  return (res as any).data;
};

export const createTeacherMessage = async (
  data: CreateTeacherMessageDTO
): Promise<TeacherMessage> => {
  const res = await apiClient.post('/teacher-messages', data);
  return (res as any).data;
};
