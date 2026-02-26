import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (userData: User, access: string, refresh: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: (userData, access, refresh) =>
        set({
          user: userData,
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        }),

      setAccessToken: (token) =>
        set((state) => ({
          ...state,
          accessToken: token,
        })),
    }),
    {
      name: 'monazem-auth-storage', // Key name in localStorage
      storage: createJSONStorage(() => localStorage), 
      // In production, we should avoid persisting accessToken in localStorage strictly if possible, 
      // but for MVP fast access it's standard. Alternatively, rely on cookies.
    }
  )
);
