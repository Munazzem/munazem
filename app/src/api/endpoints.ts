import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://munazzem.tech';

function resolveApiBaseUrl(): string {
  // 1. If explicit URL is provided in env and it's not a localhost/lan IP
  const explicitUrl = process.env.EXPO_PUBLIC_API_URL;
  if (explicitUrl && !explicitUrl.includes('localhost') && !explicitUrl.includes('127.0.0.1') && !explicitUrl.includes('192.168.')) {
    return explicitUrl.replace(/\/+$/, '');
  }

  // 2. If running inside web browser
  if (Platform.OS === 'web') {
    return (explicitUrl || PRODUCTION_API_URL).replace(/\/+$/, '');
  }

  // 3. In local dev mode with Metro bundler: dynamically use Metro host IP
  if (__DEV__) {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      const hostIp = hostUri.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return `http://${hostIp}:5000`;
      }
    }
  }

  // 4. Default fallback for standalone APK / Production
  return PRODUCTION_API_URL;
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
