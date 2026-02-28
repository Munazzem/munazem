import { Document, Types } from 'mongoose';
import { UserRole, TeacherStage } from '../common/enums/enum.service.js';

export interface IUser {
  name:      string;
  email:     string;
  phone:     string;
  password?: string;
  role:      UserRole;
  teacherId: Types.ObjectId | null;
  stage:     TeacherStage | null;   // إعدادي أو ثانوي — للمدرسين فقط
  isActive:  boolean;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}