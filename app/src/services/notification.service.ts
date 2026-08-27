import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ── Safely configure notification appearance ──────────────────────────────────
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Silent catch for unsupported environments
}

export const NotificationService = {
  /**
   * Requests device notification permissions and sets Android channel.
   * Returns true if granted.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const settings = await Notifications.getPermissionsAsync();
      let isGranted = settings.granted;

      if (!isGranted) {
        const requested = await Notifications.requestPermissionsAsync();
        isGranted = requested.granted;
      }

      if (!isGranted) {
        return false;
      }

      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'تنبيهات منظم',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0f4c81',
            sound: 'default',
            enableVibrate: true,
          });
        } catch (chanErr) {
          // Channel error fallback
        }
      }

      return true;
    } catch (error) {
      console.warn('[NotificationService] Permission check skipped or failed:', error);
      return false;
    }
  },

  /**
   * Returns the Expo Push Token suitable for sending via the Expo Push API.
   * Gracefully returns null in Expo Go or unsupported environments without crashing.
   */
  async getPushToken(): Promise<string | null> {
    try {
      // In Expo Go SDK 53+, remote push notifications are not supported directly in Expo Go
      const isExpoGo =
        Constants.appOwnership === 'expo' ||
        Constants.executionEnvironment === 'storeClient';

      if (isExpoGo) {
        // Return null gracefully in Expo Go (works in custom dev build / production build)
        return null;
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId ??
        '9aa64a08-2aad-4799-946c-4cb7a9bf4798';

      const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
      return expoPushToken?.data ?? null;
    } catch (error) {
      console.warn('[NotificationService] Push token acquisition failed:', error);
      return null;
    }
  },

  /**
   * Listens for notification taps and extracts deep link payload.
   */
  addNotificationResponseListener(callback: (deepLinkUrl?: string) => void) {
    try {
      return Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
        if (data?.deepLink) {
          callback(data.deepLink as string);
        }
      });
    } catch (e) {
      return { remove: () => {} };
    }
  },

  /**
   * Listens for foreground notifications (app is open).
   */
  addForegroundNotificationListener(
    callback: (notificationContent: Record<string, any>) => void
  ) {
    try {
      return Notifications.addNotificationReceivedListener((n: any) =>
        callback(n?.request?.content ?? {})
      );
    } catch (e) {
      return { remove: () => {} };
    }
  },

  /**
   * Clears the app badge count.
   */
  async clearBadge(): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (e) {
      // Ignore silently
    }
  },
};
