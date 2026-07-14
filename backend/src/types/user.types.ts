import { Document, Types } from 'mongoose';
import { UserRole, TeacherStage } from '../common/enums/enum.service.js';

export interface IUser {
  name:      string;
  email:     string;
  phone:     string;
  password?: string;
  role:      UserRole;
  teacherId: Types.ObjectId | null;
  stages:    TeacherStage[];        // إعدادي، ثانوي، أو كلاهما — للمدرسين فقط
  salary:    number | null;         // راتب شهري — للمساعدين فقط
  isActive:  boolean;
  centerName?: string;              // اسم السنتر — للمدرسين فقط
  logoUrl?:    string;              // لوجو السنتر — للمدرسين فقط
  assistantPermissions?: {
    canTakeAttendance: boolean;
    canEditAttendance: boolean;
    canViewAttendance: boolean;
    canRecordPayments: boolean;
    canViewReports:    boolean;
  };
  whatsappQr?:     string | null;   // QR data for frontend rendering
  whatsappStatus?: 'disconnected' | 'pending' | 'connected';
  subject?:        string;
  assistantsAccessEnabled?: boolean;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}