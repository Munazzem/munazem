export enum UserRole {
    superAdmin = 'SUPER_ADMIN',
    teacher = 'TEACHER',
    assistant = 'ASSISTANT',
}

export enum TeacherStage {
    preparatory = 'PREPARATORY',
    secondary = 'SECONDARY',
}

export interface IUser {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    teacherId?: string | null;
    stage?: TeacherStage | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UserResponse {
    status: number;
    success: boolean;
    message: string;
    data: IUser;
}

export interface UsersListResponse {
    status: number;
    success: boolean;
    message: string;
    data: IUser[];
}
