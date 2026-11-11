import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
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

const TAB_HEIGHT = 64;

interface TabIconProps {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ Icon, focused }) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    <Icon
      size={20}
      color={focused ? '#38bdf8' : '#64748b'}
      strokeWidth={focused ? 2.4 : 1.8}
    />
  </View>
);

export const AppTabsNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 10);
  const tabHeight = TAB_HEIGHT + bottomPadding;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#07152b',
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 16,
        },
        tabBarLabelStyle: {
          fontFamily: typography.bold,
          fontSize: 11,
          marginTop: 2,
          paddingBottom: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Bell} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AttendanceTab"
        component={AttendanceScreen}
        options={{
          tabBarLabel: 'الغياب والحضور',
          tabBarIcon: ({ focused }) => <TabIcon Icon={CalendarCheck} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="GradesTab"
        component={GradesScreen}
        options={{
          tabBarLabel: 'الدرجات',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Award} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'الإعدادات',
          tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
});
