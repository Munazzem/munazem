import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, ENDPOINTS } from './endpoints';
import { StorageService } from '../services/storage.service';
import { useAuthStore } from '../store/auth.store';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ─── Request Interceptor: Attach Bearer & Device ID ─────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await StorageService.getAccessToken();
    const deviceId = await StorageService.getOrCreateDeviceId();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (deviceId) {
      config.headers['X-Device-Id'] = deviceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: Sliding Token & 401 Auto-Refresh ─────────────────
apiClient.interceptors.response.use(
  (response) => {
    // Check if backend returned sliding fresh token in headers
    const slidingToken = response.headers['x-new-token'];
    if (slidingToken) {
      StorageService.setAccessToken(slidingToken);
      useAuthStore.getState().updateAccessToken(slidingToken);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Do not attempt refresh on login or refresh routes themselves
    if (originalRequest.url?.includes('/auth/verify-barcode') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await StorageService.getRefreshToken();
      const deviceId = await StorageService.getOrCreateDeviceId();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post(`${API_BASE_URL}${ENDPOINTS.REFRESH}`, {
        refreshToken,
        deviceId,
      });

      const { token: newAccessToken, refreshToken: newRefreshToken } = response.data.data;

      await StorageService.setAccessToken(newAccessToken);
      if (newRefreshToken) {
        await StorageService.setRefreshToken(newRefreshToken);
      }

      useAuthStore.getState().updateAccessToken(newAccessToken);

      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh failed — force logout
      await useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);
