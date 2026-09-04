import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'monazem_parent_access_token',
  REFRESH_TOKEN: 'monazem_parent_refresh_token',
  DEVICE_ID: 'monazem_parent_device_id',
  USER_DATA: 'monazem_parent_user_data',
  PERMISSION_ASKED_AT: 'monazem_parent_permission_asked_at',
} as const;

// In-memory fallback for web/testing environment if SecureStore isn't native
const memoryFallback = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      memoryFallback.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch (error) {
    console.warn(`[StorageService] Failed to set ${key}:`, error);
    memoryFallback.set(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return memoryFallback.get(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`[StorageService] Failed to get ${key}:`, error);
    return memoryFallback.get(key) ?? null;
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      memoryFallback.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`[StorageService] Failed to delete ${key}:`, error);
    memoryFallback.delete(key);
  }
}

export const StorageService = {
  // Access Token
  async getAccessToken(): Promise<string | null> {
    return getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  async setAccessToken(token: string): Promise<void> {
    return setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  },
  async removeAccessToken(): Promise<void> {
    return deleteItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  // Refresh Token (Encrypted)
  async getRefreshToken(): Promise<string | null> {
    return getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },
  async setRefreshToken(token: string): Promise<void> {
    return setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  },
  async removeRefreshToken(): Promise<void> {
    return deleteItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  // Persistent Device ID
  async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
      // Generate a persistent UUID for this device installation
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      await setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    return deviceId;
  },

  // Clear all session credentials on logout
  async clearSession(): Promise<void> {
    await Promise.all([
      deleteItem(STORAGE_KEYS.ACCESS_TOKEN),
      deleteItem(STORAGE_KEYS.REFRESH_TOKEN),
      deleteItem(STORAGE_KEYS.USER_DATA),
    ]);
  },

  // Generic key-value access (for child.store etc.)
  async getItem(key: string): Promise<string | null> {
    return getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    return setItem(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    return deleteItem(key);
  },
};
