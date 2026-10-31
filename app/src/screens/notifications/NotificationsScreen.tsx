import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { NotificationsApi } from '../../api/notifications.api';
import { useChildStore } from '../../store/child.store';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BellRing,
  CalendarCheck,
  Award,
  Wallet,
  AlertCircle,
} from 'lucide-react-native';

export const NotificationsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => NotificationsApi.getNotifications({ page: 1, limit: 30 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => NotificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.notifications || [];

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case 'ATTENDANCE_ABSENT':
        return <AlertCircle size={20} color={colors.danger} />;
      case 'ATTENDANCE_PRESENT':
        return <CalendarCheck size={20} color={colors.success} />;
      case 'EXAM_RESULT':
        return <Award size={20} color={colors.primary} />;
      case 'PAYMENT_RECORDED':
      case 'CYCLE_STARTED':
        return <Wallet size={20} color={colors.warning} />;
      default:
        return <BellRing size={20} color={colors.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>مركز الإشعارات</Text>
          {data?.unreadCount && data.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{data.unreadCount} جديد</Text>
            </View>
          ) : null}
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <EmptyState
                title="أنت على اطلاع بكل جديد"
                description="ستصلك إشعارات الحضور والغياب ودرجات الامتحانات والمدفوعات هنا فور تسجيلها."
                icon={<BellRing size={48} color={colors.primary} />}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (!item.isRead) {
                  markReadMutation.mutate(item.id);
                }

                // If notification belongs to a student, activate that student & subject
                if (item.studentId) {
                  const familyData = queryClient.getQueryData<any>(['family-overview']);
                  const targetChild = familyData?.children?.find(
                    (c: any) =>
                      c.id === item.studentId ||
                      c.subjects?.some((s: any) => s.studentId === item.studentId)
                  );
                  if (targetChild) {
                    useChildStore.getState().setSelectedChild(targetChild);
                    const targetSub = targetChild.subjects?.find(
                      (s: any) => s.studentId === item.studentId
                    );
                    if (targetSub) {
                      useChildStore.getState().setSelectedSubjectId(targetSub.studentId);
                    }
                  }
                }

                const notifType: string = String(item.type ?? '');
                if (
                  notifType === 'ATTENDANCE_ABSENT' ||
                  notifType === 'ATTENDANCE_PRESENT' ||
                  notifType.includes('ATTENDANCE')
                ) {
                  navigation.navigate('MainTabs', { screen: 'AttendanceTab' } as any);
                } else if (notifType === 'EXAM_RESULT' || notifType.includes('EXAM')) {
                  navigation.navigate('MainTabs', { screen: 'GradesTab' } as any);
                } else if (
                  notifType === 'PAYMENT_RECORDED' ||
                  notifType === 'CYCLE_STARTED' ||
                  notifType.includes('PAYMENT') ||
                  notifType.includes('FINANCIAL')
                ) {
                  navigation.navigate('FinanceDetail', {
                    studentId: item.studentId || '',
                    studentName: item.studentName || '',
                  });
                } else {
                  navigation.navigate('MainTabs', { screen: 'HomeTab' } as any);
                }
              }}
            >
              <Card
                variant="elevated"
                style={
                  [
                    styles.notificationCard,
                    !item.isRead && styles.unreadCard,
                  ] as any
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    {renderNotificationIcon(item.type)}
                  </View>
                  <View style={styles.textWrapper}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardBody}>{item.body}</Text>
                    <Text style={styles.timeText}>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString('ar-EG', {
                            weekday: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.extraBold,
    fontSize: 26,
    color: '#ffffff',
  },
  unreadBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  unreadBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#38bdf8',
  },
  listContent: {
    paddingBottom: 100,
  },
  notificationCard: {
    marginBottom: spacing.sm + 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  unreadCard: {
    borderColor: '#0f4c81',
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: '#0f172a',
    textAlign: 'right',
  },
  cardBody: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#475569',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  timeText: {
    fontFamily: typography.medium,
    fontSize: 11,
    color: '#64748b',
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
