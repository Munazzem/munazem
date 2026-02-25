import { Document, Types } from 'mongoose';
import { UserRole, SubscriptionStatus } from '../common/enums/enum.service.js'; 

export interface IUser {
  name: string;
  email:string;
  phone: string;
  password?: string;
  role: UserRole;
  teacherId: Types.ObjectId | null;
  subscription?: {
    status:SubscriptionStatus;
    expiryDate: Date | null;
  };
  isActive: boolean;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}