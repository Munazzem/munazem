import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTabsParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { AttendanceScreen } from '../screens/attendance/AttendanceScreen';
import { GradesScreen } from '../screens/grades/GradesScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Home, Bell, CalendarCheck, Award, Settings } from 'lucide-react-native';

const Tab = createBottomTabNavigator<AppTabsParamList>();

const TAB_HEIGHT = 60;

export const AppTabsNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const tabHeight = TAB_HEIGHT + bottomPadding;

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
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontFamily: typography.bold,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceScreen}
        options={{
          tabBarLabel: 'الغياب والحضور',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="GradesTab"
        component={GradesScreen}
        options={{
          tabBarLabel: 'الدرجات',
          tabBarIcon: ({ color, size }) => <Award size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'الإعدادات',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
};
