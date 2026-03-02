import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';
import type { AuthState } from '@/types/auth.types';

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
                Cookies.set('token', token, {
                    expires: 1,
                    path: '/',
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });
                set({ user, token, isAuthenticated: true });
            },
            
            logout: () => {
                Cookies.remove('token', { path: '/' });
                set({ user: null, token: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage', // name of item in the storage (must be unique)
            storage: createJSONStorage(() => localStorage), // (optional) by default the 'localStorage' is used
            // We only need to persist the user object, as the token is managed by js-cookie for API requests
            partialize: (state) => ({ user: state.user }),
        }
    )
);
