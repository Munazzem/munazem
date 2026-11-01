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
 * Wipes ALL IndexedDB offline data and React Query persister cache.
 * Runs asynchronously — fire-and-forget on logout.
 */
async function purgeOfflineCache(): Promise<void> {
    try {
        // Dynamically import to avoid circular deps at module load time
        const { clearAllOfflineData } = await import('@/lib/offline/db');
        await clearAllOfflineData(false); // false = also wipe outbox on logout

        // Also clear the React Query IDB persister key
        const { deleteKeyVal } = await import('@/lib/offline/db');
        await deleteKeyVal('REACT_QUERY_OFFLINE_CACHE').catch(() => {});

        console.log('[AuthStore] ✅ Offline IndexedDB cache purged on logout.');
    } catch (err) {
        console.warn('[AuthStore] Failed to purge offline cache:', err);
    }
}

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
                    try {
                        localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
                    } catch {}
                }

                // 🔑 Key fix: wipe ALL IndexedDB offline data to prevent cross-tenant leaks
                purgeOfflineCache();

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

