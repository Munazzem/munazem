export interface ParentUser {
  id: string;
  phone: string;
  name?: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface DiscoveredStudent {
  studentId: string;
  studentName: string;
  gradeLevel: string;
  teacherName: string;
  subject: string;
  groupName: string;
}

export interface VerifyBarcodeResponse {
  parent: ParentUser;
  token: string;
  refreshToken: string;
  discoveredStudents: DiscoveredStudent[];
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface DeviceSession {
  deviceId: string;
  platform: 'ios' | 'android';
  fcmToken?: string;
  appVersion?: string;
}
