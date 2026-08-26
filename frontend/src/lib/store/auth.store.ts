import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';
import type { AuthState } from '@/types/auth.types';

/**
 * Safe LocalStorage wrapper to prevent DOMExceptions / QuotaExceededError in restricted
 * mobile browsers (e.g. Safari Private Mode, Android WebViews, disabled storage).
 */
const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            if (typeof window !== 'undefined') {
                return localStorage.getItem(key);
            }
        } catch {}
        return null;
    },
    setItem: (key: string, value: string): void => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(key, value);
            }
        } catch {}
    },
    removeItem: (key: string): void => {
        try {
            if (typeof window !== 'undefined') {
                localStorage.removeItem(key);
            }
        } catch {}
    },
};

/**
 * Zustand Store for Global Authentication State.
 * Utilizes persist middleware to retain user data across page reloads.
 */
export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: typeof window !== 'undefined' ? Cookies.get('token') || null : null,
            isAuthenticated: typeof window !== 'undefined' ? !!Cookies.get('token') : false,
            
            login: (user, token) => {
                const normalizedUser = user ? {
                    ...user,
                    id: user.id || (user as any)._id,
                } : null;
                
                try {
                    Cookies.set('token', token, {
                        expires: 1,
                        path: '/',
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                    });
                } catch (cookieErr) {
                    console.error('Failed to set auth cookie:', cookieErr);
                }

                set({ user: normalizedUser, token, isAuthenticated: true });
            },
            
            logout: () => {
                try {
                    Cookies.remove('token', { path: '/' });
                } catch {}
                if (typeof window !== 'undefined') {
                    safeLocalStorage.removeItem('auth-storage');
                }
                set({ user: null, token: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage', // name of item in the storage (must be unique)
            storage: createJSONStorage(() => safeLocalStorage),
            // We only need to persist the user object, as the token is managed by js-cookie for API requests
            partialize: (state) => ({ user: state.user }),
        }
    )
);
