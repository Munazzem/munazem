/**
 * Authentication Types
 */

export interface User {
    id: string;
    name: string;
    role: 'superAdmin' | 'teacher' | 'assistant';
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (user: User, token: string) => void;
    logout: () => void;
}
