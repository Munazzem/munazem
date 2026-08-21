import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTabsParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Home, Bell, User } from 'lucide-react-native';

const Tab = createBottomTabNavigator<AppTabsParamList>();

export const AppTabsNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);
  const tabHeight = 58 + bottomPadding;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 5,
        },
        tabBarLabelStyle: {
          fontFamily: typography.bold,
          fontSize: 12,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{
          tabBarLabel: 'حسابي',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
};
