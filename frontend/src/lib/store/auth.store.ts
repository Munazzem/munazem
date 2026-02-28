import { create } from 'zustand';
import Cookies from 'js-cookie';
import type { AuthState } from '@/types/auth.types';

/**
 * Zustand Store for Global Authentication State.
 * This keeps the user session synchronized across the React Tree.
 */
export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: typeof window !== 'undefined' ? Cookies.get('token') || null : null,
    isAuthenticated: typeof window !== 'undefined' ? !!Cookies.get('token') : false,
    
    login: (user, token) => {
        Cookies.set('token', token, { expires: 7, path: '/' }); // 7 days expiry
        set({ user, token, isAuthenticated: true });
    },
    
    logout: () => {
        Cookies.remove('token', { path: '/' });
        set({ user: null, token: null, isAuthenticated: false });
        // Full reload or redirect is handled by middleware or components naturally
    },
}));
