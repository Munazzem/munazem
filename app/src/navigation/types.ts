import { NavigatorScreenParams } from '@react-navigation/native';
import { DiscoveredStudent } from '../types/auth.types';

// Auth Stack Navigation
export type AuthStackParamList = {
  Welcome: undefined;
  PhoneEntry: undefined;
  BarcodeScanner: { parentPhone?: string } | undefined;
  ManualBarcode: { parentPhone?: string } | undefined;
  AutoDiscoveryConfirm: {
    discoveredStudents: DiscoveredStudent[];
  };
};

// Bottom Tabs Navigation
export type AppTabsParamList = {
  HomeTab: undefined;
  NotificationsTab: undefined;
  AccountTab: undefined;
};

// Root Stack Navigation
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<AppTabsParamList>;
  ChildDetails: {
    studentId: string;
    studentName: string;
    initialTab?: 'attendance' | 'exams' | 'financial';
  };
  BarcodeScanner: { parentPhone?: string } | undefined;
  ManualBarcode: { parentPhone?: string } | undefined;
};
