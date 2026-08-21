import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import { ApiResponse } from '../types/api.types';
import { VerifyBarcodeResponse } from '../types/auth.types';
import { StorageService } from '../services/storage.service';
import { Platform } from 'react-native';

export const AuthApi = {
  /**
   * Primary verification via QR/Barcode or Phone + Barcode
   */
  async verifyBarcode(params: {
    barcode: string;
    parentPhone?: string;
  }): Promise<VerifyBarcodeResponse> {
    const deviceId = await StorageService.getOrCreateDeviceId();
    const response = await apiClient.post<ApiResponse<VerifyBarcodeResponse>>(
      ENDPOINTS.VERIFY_BARCODE,
      {
        ...params,
        deviceId,
        platform: Platform.OS,
      }
    );
    return response.data.data;
  },

  /**
   * Direct Login via Parent Phone Number
   */
  async loginByPhone(params: { parentPhone: string }): Promise<VerifyBarcodeResponse> {
    const deviceId = await StorageService.getOrCreateDeviceId();
    const response = await apiClient.post<ApiResponse<VerifyBarcodeResponse>>(
      ENDPOINTS.LOGIN_PHONE,
      {
        parentPhone: params.parentPhone,
        deviceId,
        platform: Platform.OS,
      }
    );
    return response.data.data;
  },

  /**
   * Confirm linking of auto-discovered children
   */
  async confirmDiscovered(studentIds: string[]): Promise<void> {
    await apiClient.post(ENDPOINTS.CONFIRM_DISCOVERED, { studentIds });
  },

  /**
   * Device logout
   */
  async logout(): Promise<void> {
    try {
      const deviceId = await StorageService.getOrCreateDeviceId();
      await apiClient.post(ENDPOINTS.LOGOUT, { deviceId });
    } catch (e) {
      console.warn('[AuthApi] Logout request failed (ignoring for local cleanup):', e);
    }
  },

  /**
   * Register or update device push notification token
   */
  async registerDeviceToken(fcmToken: string): Promise<void> {
    const deviceId = await StorageService.getOrCreateDeviceId();
    await apiClient.post(ENDPOINTS.REGISTER_DEVICE_TOKEN, {
      deviceId,
      fcmToken,
      platform: Platform.OS,
    });
  },
};
