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
import { NotificationsApi } from '../../api/notifications.api';
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
                title="أنت على اطلاع بكل جديد! 🎉"
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
    ...textStyles.h2,
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  listContent: {
    paddingBottom: 100,
  },
  notificationCard: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  unreadCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  textWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
  },
  cardBody: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 18,
  },
  timeText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
});
