import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NotificationService = {
  /**
   * Requests device notification permissions
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
        await Notifications.setNotificationChannelAsync('default', {
          name: 'تنبيهات منظم',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0f4c81',
        });
      }

      return true;
    } catch (error) {
      console.warn('[NotificationService] Error requesting permission:', error);
      return false;
    }
  },

  /**
   * Retrieves the current push notification device token
   */
  async getPushToken(): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      const tokenData = await Notifications.getDevicePushTokenAsync();
      return tokenData.data;
    } catch (error) {
      console.warn('[NotificationService] Error getting push token:', error);
      return null;
    }
  },

  /**
   * Listens for notification taps and extracts deep link payload
   */
  addNotificationResponseListener(callback: (deepLinkUrl?: string) => void) {
    return Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data && data.deepLink) {
        callback(data.deepLink as string);
      }
    });
  },
};
