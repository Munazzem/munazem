import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { ApiResponse } from '../types/api.types';
import { FamilyOverviewData } from '../types/child.types';

export const HomeApi = {
  /**
   * Fetches Family Overview + Summary cards for all linked children
   */
  async getFamilyOverview(): Promise<FamilyOverviewData> {
    const response = await apiClient.get<ApiResponse<FamilyOverviewData>>(ENDPOINTS.HOME);
    return response.data.data;
  },
};
