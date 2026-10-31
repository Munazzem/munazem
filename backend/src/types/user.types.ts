import { Document, Types } from 'mongoose';
import { UserRole, TeacherStage, CenterSupervisorType } from '../common/enums/enum.service.js';
import type { ISupervisorPermissions } from './center.types.js';

export interface IAssistantPermissions {
  canTakeAttendance:    boolean; // تسجيل الحضور والغياب (باركود/يدوي)
  canEditAttendance:    boolean; // تعديل سجلات الحضور السابقة
  canViewAttendance:    boolean; // عرض كشوفات وسجلات الحضور
  canManageSessions:    boolean; // إنشاء وإدارة الحصص
  canRecordPayments:    boolean; // تحصيل وتسجيل اشتراكات الطلاب
  canViewFinancials:    boolean; // الاطلاع على التقارير المالية والخزينة
  canManageStudents:    boolean; // إضافة وتعديل بيانات الطلاب
  canManageGroups:      boolean; // إدارة المجموعات والمواعيد
  canCreateExams:       boolean; // إنشاء وتعديل الامتحانات
  canGradeExams:        boolean; // تصحيح ورصد درجات الامتحانات
  canManageNotebooks:   boolean; // إدارة المذكرات والملازم
  canSendNotifications: boolean; // إرسال الرسائل والإشعارات
}

export type AssistantType = 'ATTENDANCE' | 'FINANCIAL' | 'ACADEMIC' | 'FULL' | 'CUSTOM';

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
  cardTemplate?: {                  // تصميم الكارت الذكي — للمدرسين فقط
    frontImageUrl?: string | null;
    backImageUrl?:  string | null;
    qrX?:           number;
    qrY?:           number;
    qrSize?:        number;
    showQrBg?:      boolean;
    showCardNumber?: boolean;
  };
  assistantType?:        AssistantType | null;
  assistantPermissions?: IAssistantPermissions;
  whatsappQr?:     string | null;   // QR data for frontend rendering
  whatsappStatus?: 'disconnected' | 'pending' | 'connected';
  subject?:        string;
  assistantsAccessEnabled?: boolean;
  features?: {
    homeworkTracking?: boolean;
  };
  // ── Center-specific fields (centerOwner & centerSupervisor only) ──
  centerId?:               Types.ObjectId | null;
  supervisorType?:         CenterSupervisorType | null;
  supervisorPermissions?:  ISupervisorPermissions;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}