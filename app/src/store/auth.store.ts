import { create } from 'zustand';
import { ParentUser, DiscoveredStudent } from '../types/auth.types';
import { StorageService } from '../services/storage.service';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  parent: ParentUser | null;
  accessToken: string | null;
  deviceId: string | null;
  discoveredStudents: DiscoveredStudent[];

  // Actions
  hydrate: () => Promise<void>;
  setSession: (params: {
    parent: ParentUser;
    accessToken: string;
    refreshToken: string;
    discoveredStudents?: DiscoveredStudent[];
  }) => Promise<void>;
  updateAccessToken: (token: string) => Promise<void>;
  setDiscoveredStudents: (students: DiscoveredStudent[]) => void;
  clearDiscoveredStudents: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  parent: null,
  accessToken: null,
  deviceId: null,
  discoveredStudents: [],

  hydrate: async () => {
    try {
      const [token, refreshToken, deviceId] = await Promise.all([
        StorageService.getAccessToken(),
        StorageService.getRefreshToken(),
        StorageService.getOrCreateDeviceId(),
      ]);

      if (token && refreshToken) {
        set({
          isAuthenticated: true,
          accessToken: token,
          deviceId,
          isLoading: false,
        });
      } else {
        set({
          isAuthenticated: false,
          accessToken: null,
          deviceId,
          isLoading: false,
        });
      }
    } catch (error) {
      console.warn('[AuthStore] Hydration error:', error);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  setSession: async ({ parent, accessToken, refreshToken, discoveredStudents = [] }) => {
    await Promise.all([
      StorageService.setAccessToken(accessToken),
      StorageService.setRefreshToken(refreshToken),
    ]);

    set({
      isAuthenticated: true,
      parent,
      accessToken,
      discoveredStudents,
    });
  },

  updateAccessToken: async (token: string) => {
    await StorageService.setAccessToken(token);
    set({ accessToken: token });
  },

  setDiscoveredStudents: (students) => {
    set({ discoveredStudents: students });
  },

  clearDiscoveredStudents: () => {
    set({ discoveredStudents: [] });
  },

  logout: async () => {
    await StorageService.clearSession();
    set({
      isAuthenticated: false,
      parent: null,
      accessToken: null,
      discoveredStudents: [],
    });
  },
}));
