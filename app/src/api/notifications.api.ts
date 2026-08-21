import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { ApiResponse } from '../types/api.types';
import { ParentNotificationItem } from '../types/notification.types';

export const NotificationsApi = {
  /**
   * Fetches paginated in-app notifications
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    type?: string;
    studentId?: string;
  }): Promise<{ notifications: ParentNotificationItem[]; unreadCount: number }> {
    const response = await apiClient.get<
      ApiResponse<{ notifications: ParentNotificationItem[]; unreadCount: number }>
    >(ENDPOINTS.NOTIFICATIONS, { params });
    return response.data.data;
  },

  /**
   * Marks a single notification as read
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.MARK_NOTIFICATION_READ(id));
  },
};
