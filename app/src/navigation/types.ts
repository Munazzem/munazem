import { NavigatorScreenParams } from '@react-navigation/native';
import { DiscoveredStudent } from '../types/auth.types';
import { ChildCardSummary } from '../types/child.types';

// Auth Stack Navigation
export type AuthStackParamList = {
  Welcome: undefined;
  LoginChoice: undefined;
  PhoneEntry: undefined;
  BarcodeScanner: { parentPhone?: string } | undefined;
  ManualBarcode: { parentPhone?: string } | undefined;
  AutoDiscoveryConfirm: {
    discoveredStudents: DiscoveredStudent[];
  };
};

// Bottom Tabs Navigation (5 tabs per spec)
export type AppTabsParamList = {
  HomeTab: undefined;
  NotificationsTab: undefined;
  AttendanceTab: undefined;
  GradesTab: undefined;
  SettingsTab: undefined;
};

// Root Stack Navigation
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  MainTabs: NavigatorScreenParams<AppTabsParamList>;

  // Per-student detail screens (stack-pushed)
  SelectChild: {
    children: ChildCardSummary[];
    mode?: 'onboarding' | 'switch';
  };
  ChildDetails: {
    studentId: string;
    studentName: string;
    initialTab?: 'attendance' | 'exams' | 'financial';
  };
  FinanceDetail: {
    studentId: string;
    studentName: string;
  };

  // Barcode scanner (accessible from authenticated context too)
  BarcodeScanner: { parentPhone?: string } | undefined;
  ManualBarcode: { parentPhone?: string } | undefined;
};
