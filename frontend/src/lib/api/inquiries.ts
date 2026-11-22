import { apiClient } from './axios';
import type {
  EscalateInquiryDTO,
  InquiryCategory,
  InquiryCountsResponse,
  InquiryDetailResponse,
  InquiryBoxFilter,
  InquiryStateFilter,
  PaginatedInquiriesResponse,
  ParentInquiry,
  ReplyInquiryDTO,
} from '@/types/inquiry.types';

interface ApiEnvelope<T> {
  status?: number;
  message?: string;
  data: T;
}

export const fetchInquiryCounts = async (): Promise<InquiryCountsResponse> => {
  const res = await apiClient.get('/inquiries/counts');
  return (res as unknown as ApiEnvelope<InquiryCountsResponse>).data;
};

export const fetchStaffInquiries = async (
  filters: {
    box?: InquiryBoxFilter;
    state?: InquiryStateFilter;
    category?: InquiryCategory;
    studentId?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<PaginatedInquiriesResponse> => {
  const res = await apiClient.get('/inquiries', { params: filters });
  return (res as unknown as ApiEnvelope<PaginatedInquiriesResponse>).data;
};

export const fetchStaffInquiryById = async (
  id: string
): Promise<InquiryDetailResponse> => {
  const res = await apiClient.get(`/inquiries/${id}`);
  return (res as unknown as ApiEnvelope<InquiryDetailResponse>).data;
};

export const replyToInquiry = async (
  id: string,
  data: ReplyInquiryDTO
): Promise<ParentInquiry> => {
  const res = await apiClient.post(`/inquiries/${id}/reply`, data);
  return (res as unknown as ApiEnvelope<ParentInquiry>).data;
};

export const escalateInquiry = async (
  id: string,
  data: EscalateInquiryDTO = {}
): Promise<ParentInquiry> => {
  const res = await apiClient.post(`/inquiries/${id}/escalate`, data);
  return (res as unknown as ApiEnvelope<ParentInquiry>).data;
};
