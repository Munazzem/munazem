import React, { useEffect, useRef } from 'react';
import { I18nManager, View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef, LinkingOptions } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo';
import * as Linking from 'expo-linking';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NotificationService } from './src/services/notification.service';
import { UpdateService } from './src/services/update.service';
import { colors } from './src/theme/colors';
import { RootStackParamList } from './src/navigation/types';

// ── App scheme deep link prefix ────────────────────────────────────────────────
const prefix = Linking.createURL('/');

// ── Deep link config: maps monazem://child/:id?tab=xxx to ChildDetails screen ──
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'monazem://'],
  config: {
    screens: {
      MainTabs: {
        screens: {
          HomeTab: 'home',
          NotificationsTab: 'notifications',
          AttendanceTab: 'attendance',
          GradesTab: 'grades',
          SettingsTab: 'settings',
        },
      },
      ChildDetails: {
        path: 'child/:studentId',
        parse: {
          studentId: (id: string) => id,
        },
      },
    },
  },
};

// ── QueryClient: persisted for the full app lifecycle ─────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // ── Auto-Update Check (OTA) ──────────────────────────────────────────────────
  useEffect(() => {
    UpdateService.checkAndApplyUpdate().catch(() => {});
    const removeForegroundListener = UpdateService.initForegroundUpdateListener();
    return () => removeForegroundListener();
  }, []);

  // Enforce Arabic RTL direction
  useEffect(() => {
    if (!I18nManager.isRTL) {
      try {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(true);
      } catch (e) {
        console.warn('[RTL] Could not enforce RTL immediately:', e);
      }
    }
  }, []);

  // ── Push Notification Listeners ──────────────────────────────────────────────
  useEffect(() => {
    // 1. Handle notification tap — navigate to deep link destination
    const tapSubscription = NotificationService.addNotificationResponseListener(
      (deepLinkUrl?: string) => {
        if (!deepLinkUrl || !navigationRef.current) return;

        // Parse monazem://child/:studentId?tab=attendance
        const parsed = Linking.parse(deepLinkUrl);
        const path = parsed.path ?? '';

        if (path.startsWith('child/')) {
          const studentId = path.replace('child/', '').split('?')[0];
          const tab = (parsed.queryParams?.tab as 'attendance' | 'exams' | 'financial') || 'attendance';

          // Navigate to ChildDetails with proper tab
          navigationRef.current.navigate('ChildDetails', {
            studentId,
            studentName: '',
            initialTab: tab,
          });
        } else if (path === 'notifications') {
          // Navigate to notifications tab
          navigationRef.current.navigate('MainTabs', {
            screen: 'NotificationsTab',
          } as any);
        }
      }
    );

    // 2. Foreground notification — just play sound/alert (already handled by setNotificationHandler)
    const foregroundSubscription = NotificationService.addForegroundNotificationListener(
      (_notificationContent: Record<string, any>) => {
        // Could show an in-app banner here in a future enhancement
      }
    );

    return () => {
      tapSubscription.remove();
      foregroundSubscription.remove();
    };
  }, []);

  // Load Cairo Google Fonts
  const [fontsLoaded] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_700Bold,
    Cairo_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <RootNavigator />
      </NavigationContainer>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
