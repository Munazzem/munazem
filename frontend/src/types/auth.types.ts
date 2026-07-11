/**
 * Authentication Types
 */

export interface User {
    id: string;
    name: string;
    role: 'superAdmin' | 'teacher' | 'assistant';
    stage?: 'PREPARATORY' | 'SECONDARY' | null;
    teacherId?: string | null;
    centerName?: string;
    logoUrl?: string;
    assistantsAccessEnabled?: boolean;
    planTier?: 'MINI' | 'BASIC' | 'PREMIUM' | null;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}
