import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginChoiceScreen } from '../screens/auth/LoginChoiceScreen';
import { PhoneEntryScreen } from '../screens/auth/PhoneEntryScreen';
import { BarcodeScannerScreen } from '../screens/auth/BarcodeScannerScreen';
import { ManualBarcodeScreen } from '../screens/auth/ManualBarcodeScreen';
import { AutoDiscoveryConfirmScreen } from '../screens/auth/AutoDiscoveryConfirmScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: typography.fontFamily.bold,
        },
        headerBackVisible: false,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LoginChoice"
        component={LoginChoiceScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhoneEntry"
        component={PhoneEntryScreen}
        options={{ title: 'تسجيل الدخول' }}
      />
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ title: 'مسح كارت الطالب' }}
      />
      <Stack.Screen
        name="ManualBarcode"
        component={ManualBarcodeScreen}
        options={{ title: 'إدخال كود الطالب' }}
      />
      <Stack.Screen
        name="AutoDiscoveryConfirm"
        component={AutoDiscoveryConfirmScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
