import { Types } from 'mongoose';
import { UserRole } from '../common/enums/enum.service.js';
import type { IUser } from './user.types.js';

export interface ILoginRequest {
    phone: string;
    password: string;
}

export interface IRegisterRequest {
    name: string;
    phone: string;
    password: string;
    role: UserRole;
    teacherId?: Types.ObjectId | string | null;
}

export interface IJwtPayload {
    userId: string;
    role: UserRole;
    teacherId: string | null;
}

export interface IAuthResponse {
    message: string;
    token: string;
    user: Omit<IUser, 'password'>;
}
