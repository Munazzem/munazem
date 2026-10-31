import { create } from 'zustand';
import { ParentUser, DiscoveredStudent } from '../types/auth.types';
import { StorageService } from '../services/storage.service';
import { NotificationService } from '../services/notification.service';
import { AuthApi } from '../api/auth.api';
import { useChildStore } from './child.store';
import { queryClient } from '../api/queryClient';

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
    // 1. Invalidate device token / session on backend (non-blocking best-effort)
    try {
      await AuthApi.logout();
    } catch (e) {
      console.warn('[AuthStore] Backend logout request failed (proceeding with local cleanup):', e);
    }

    // 2. Clear credentials and storage
    try {
      await StorageService.clearSession();
    } catch (e) {
      console.warn('[AuthStore] Failed to clear session storage:', e);
    }

    // 3. Clear app badge
    try {
      await NotificationService.clearBadge();
    } catch {}

    // 4. Reset selected child state
    try {
      await useChildStore.getState().clearSelectedChild();
    } catch (e) {
      console.warn('[AuthStore] Failed to clear selected child state:', e);
    }

    // 5. Reset React Query cache
    try {
      queryClient.clear();
    } catch (e) {
      console.warn('[AuthStore] Failed to clear query client cache:', e);
    }

    // 6. Reset auth state
    set({
      isAuthenticated: false,
      parent: null,
      accessToken: null,
      discoveredStudents: [],
    });
  },
}));
