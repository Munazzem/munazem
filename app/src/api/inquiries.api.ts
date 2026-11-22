import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { ApiResponse } from '../types/api.types';
import {
  CreateParentInquiryDTO,
  PaginatedParentInquiriesResponse,
  ParentInquiry,
} from '../types/inquiry.types';

export const InquiriesApi = {
  /**
   * Fetches paginated inquiries for the authenticated parent (optionally filtered by studentId)
   */
  async getInquiries(params?: {
    studentId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedParentInquiriesResponse> {
    const response = await apiClient.get<
      ApiResponse<PaginatedParentInquiriesResponse>
    >(ENDPOINTS.INQUIRIES, { params });
    return response.data.data;
  },

  /**
   * Fetches details of a single inquiry
   */
  async getInquiryById(id: string): Promise<ParentInquiry> {
    const response = await apiClient.get<ApiResponse<ParentInquiry>>(
      ENDPOINTS.INQUIRY_DETAILS(id)
    );
    return response.data.data;
  },

  /**
   * Creates a new inquiry (idempotent via clientRequestId)
   */
  async createInquiry(data: CreateParentInquiryDTO): Promise<ParentInquiry> {
    const response = await apiClient.post<ApiResponse<ParentInquiry>>(
      ENDPOINTS.INQUIRIES,
      data
    );
    return response.data.data;
  },

  /**
   * Updates the body of a PENDING inquiry (up to 3 edits)
   */
  async updateInquiry(id: string, body: string): Promise<ParentInquiry> {
    const response = await apiClient.patch<ApiResponse<ParentInquiry>>(
      ENDPOINTS.INQUIRY_DETAILS(id),
      { body }
    );
    return response.data.data;
  },

  /**
   * Soft-cancels a PENDING inquiry
   */
  async cancelInquiry(id: string): Promise<ParentInquiry> {
    const response = await apiClient.post<ApiResponse<ParentInquiry>>(
      ENDPOINTS.CANCEL_INQUIRY(id)
    );
    return response.data.data;
  },
};
