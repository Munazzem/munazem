import Constants from 'expo-constants';
import { Platform } from 'react-native';

function resolveApiBaseUrl(): string {
  // 1. Explicit env var if set
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Running on Web inside browser
  if (Platform.OS === 'web') {
    return 'http://localhost:5000';
  }

  // 3. Running on physical device or emulator via Expo Go / dev client:
  // Extract host IP dynamically from Metro bundler hostUri (e.g. "192.168.1.6:8081" -> "http://192.168.1.6:5000")
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp) {
      return `http://${hostIp}:5000`;
    }
  }

  return 'http://192.168.1.6:5000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const ENDPOINTS = {
  // Auth
  VERIFY_BARCODE: '/parent/auth/verify-barcode',
  LOGIN_PHONE: '/parent/auth/login-phone',
  REFRESH: '/parent/auth/refresh',
  CONFIRM_DISCOVERED: '/parent/auth/confirm-discovered',
  LOGOUT: '/parent/auth/logout',

  // Home & Children
  HOME: '/parent/home',
  STUDENT_DETAILS: (studentId: string) => `/parent/students/${studentId}`,
  STUDENT_CARD: (studentId: string) => `/parent/students/${studentId}/card`,
  STUDENT_ATTENDANCE: (studentId: string) => `/parent/students/${studentId}/attendance`,
  STUDENT_EXAMS: (studentId: string) => `/parent/students/${studentId}/exams`,
  STUDENT_FINANCIAL: (studentId: string) => `/parent/students/${studentId}/financial`,

  // Notifications
  NOTIFICATIONS: '/parent/notifications',
  MARK_NOTIFICATION_READ: (id: string) => `/parent/notifications/${id}/read`,
  REGISTER_DEVICE_TOKEN: '/parent/device/token',
} as const;
