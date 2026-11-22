import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { AppTabsNavigator } from './AppTabsNavigator';
import { ChildDetailsScreen } from '../screens/child/ChildDetailsScreen';
import { SelectChildScreen } from '../screens/child/SelectChildScreen';
import { FinanceScreen } from '../screens/finance/FinanceScreen';
import { BarcodeScannerScreen } from '../screens/auth/BarcodeScannerScreen';
import { ManualBarcodeScreen } from '../screens/auth/ManualBarcodeScreen';
import { InquiriesScreen } from '../screens/inquiries/InquiriesScreen';
import { InquiryDetailScreen } from '../screens/inquiries/InquiryDetailScreen';
import { InquiryComposeScreen } from '../screens/inquiries/InquiryComposeScreen';
import { useAuthStore } from '../store/auth.store';
import { useChildStore } from '../store/child.store';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

import { NotificationService } from '../services/notification.service';
import { StorageService } from '../services/storage.service';
import { AuthApi } from '../api/auth.api';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const { hydrateSelectedChild } = useChildStore();

  useEffect(() => {
    hydrate();
    hydrateSelectedChild();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      StorageService.getNotificationsEnabled().then((isEnabled) => {
        if (isEnabled) {
          NotificationService.getPushToken().then((token) => {
            if (token) {
              AuthApi.registerDeviceToken(token).catch(() => {});
            }
          }).catch(() => {});
        }
      });
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={AppTabsNavigator} />
          <Stack.Screen
            name="SelectChild"
            component={SelectChildScreen}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="ChildDetails"
            component={ChildDetailsScreen}
            options={({ route }) => ({
              headerShown: true,
              title: route.params.studentName || 'تفاصيل الطالب',
              headerTintColor: colors.primary,
              headerTitleStyle: { fontFamily: typography.fontFamily.bold },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
            })}
          />
          <Stack.Screen
            name="FinanceDetail"
            component={FinanceScreen}
            options={({ route }) => ({
              headerShown: true,
              title: `المالية — ${route.params.studentName}`,
              headerTintColor: colors.textInverse,
              headerTitleStyle: { fontFamily: typography.fontFamily.bold, color: colors.textInverse },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.navy },
            })}
          />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{
              presentation: 'fullScreenModal',
              animation: 'fade_from_bottom',
            }}
          />
          <Stack.Screen
            name="ManualBarcode"
            component={ManualBarcodeScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="Inquiries"
            component={InquiriesScreen}
            options={{
              headerShown: true,
              title: 'الاستفسارات والطلبات',
              headerTintColor: colors.textInverse,
              headerTitleStyle: {
                fontFamily: typography.fontFamily.bold,
                color: colors.textInverse,
              },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.navy },
            }}
          />
          <Stack.Screen
            name="InquiryDetail"
            component={InquiryDetailScreen}
            options={{
              headerShown: true,
              title: 'تفاصيل الطلب والرد',
              headerTintColor: colors.textInverse,
              headerTitleStyle: {
                fontFamily: typography.fontFamily.bold,
                color: colors.textInverse,
              },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.navy },
            }}
          />
          <Stack.Screen
            name="InquiryCompose"
            component={InquiryComposeScreen}
            options={({ route }) => ({
              headerShown: true,
              title:
                route.params.mode === 'edit'
                  ? 'تعديل نص الطلب'
                  : 'إرسال استفسار جديد',
              headerTintColor: colors.textInverse,
              headerTitleStyle: {
                fontFamily: typography.fontFamily.bold,
                color: colors.textInverse,
              },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.navy },
            })}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
