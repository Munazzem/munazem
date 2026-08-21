import mongoose, { Document } from 'mongoose';

export interface IParentDocument extends Document {
  phone: string;
  name?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ParentStudentStatus = 'ACTIVE' | 'REVOKED';
export type VerifiedViaType = 'BARCODE_SCAN' | 'BARCODE_MANUAL' | 'AUTO_CONFIRMED';

export interface IParentStudentDocument extends Document {
  parentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  status: ParentStudentStatus;
  verifiedVia: VerifiedViaType;
  linkedAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  audit?: {
    linkedByDeviceId?: string;
    linkedIp?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IParentDeviceDocument extends Document {
  parentId: mongoose.Types.ObjectId;
  deviceId: string;
  fcmToken?: string;
  platform: 'ios' | 'android';
  refreshTokenHash: string;
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  isActive: boolean;
  lastSeenAt: Date;
  lastTokenRotationAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum ParentNotificationType {
  ATTENDANCE_ABSENT = 'ATTENDANCE_ABSENT',
  ATTENDANCE_PRESENT = 'ATTENDANCE_PRESENT',
  EXAM_RESULT = 'EXAM_RESULT',
  PAYMENT_RECORDED = 'PAYMENT_RECORDED',
  CYCLE_STARTED = 'CYCLE_STARTED',
}

export interface IParentNotificationDocument extends Document {
  parentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  type: ParentNotificationType;
  title: string;
  body: string;
  deepLink: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IParentJwtPayload {
  parentId: string;
  phone: string;
  deviceId: string;
  role: 'parent';
  isActive: boolean;
  iat?: number;
  exp?: number;
}
