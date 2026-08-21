import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { AppTabsNavigator } from './AppTabsNavigator';
import { ChildDetailsScreen } from '../screens/child/ChildDetailsScreen';
import { BarcodeScannerScreen } from '../screens/auth/BarcodeScannerScreen';
import { ManualBarcodeScreen } from '../screens/auth/ManualBarcodeScreen';
import { useAuthStore } from '../store/auth.store';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

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
            name="ChildDetails"
            component={ChildDetailsScreen}
            options={({ route }) => ({
              headerShown: true,
              title: route.params.studentName || 'تفاصيل الطالب',
              headerTintColor: colors.primary,
              headerTitleStyle: {
                fontFamily: typography.fontFamily.bold,
              },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
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
