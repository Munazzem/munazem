import { Document, Types } from 'mongoose';
import { UserRole, TeacherStage } from '../common/enums/enum.service.js';
export interface IUser {
    name: string;
    email: string;
    phone: string;
    password?: string;
    role: UserRole;
    teacherId: Types.ObjectId | null;
    stage: TeacherStage | null;
    salary: number | null;
    isActive: boolean;
    centerName?: string;
    logoUrl?: string;
    whatsappQr?: string | null;
    whatsappStatus?: 'disconnected' | 'pending' | 'connected';
    subject?: string;
}
export interface IUserDocument extends IUser, Document {
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=user.types.d.ts.map