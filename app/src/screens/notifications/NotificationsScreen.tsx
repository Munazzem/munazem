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
  Clock,
  User,
  Users,
  BookOpen,
  RotateCcw,
} from 'lucide-react-native';
import { AttendanceNotificationData, ParentNotificationItem } from '../../types/notification.types';

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

  const renderNotificationIcon = (type: string, notificationData?: AttendanceNotificationData) => {
    if (notificationData?.isCorrection) {
      return <RotateCcw size={20} color={colors.warning} />;
    }
    if (notificationData?.kind === 'GUEST_COMPENSATED' || notificationData?.kind === 'COMPENSATED_ADVANCE') {
      return <CalendarCheck size={20} color={colors.compensation} />;
    }
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

  const getAttendanceBadgeConfig = (notifData: AttendanceNotificationData) => {
    const { kind, status } = notifData;
    if (kind === 'GUEST_COMPENSATED') {
      return { label: 'حصة معوضة', bg: colors.compensationLight, color: colors.compensation };
    }
    if (kind === 'COMPENSATED_ADVANCE') {
      return { label: 'معوض مسبقاً', bg: colors.compensationLight, color: colors.compensation };
    }
    if (kind === 'GUEST') {
      return { label: 'حاضر (زائر)', bg: colors.warningLight, color: colors.warningDark };
    }
    if (status === 'LATE' || kind === 'LATE') {
      return { label: 'متأخر', bg: colors.warningLight, color: colors.warningDark };
    }
    if (status === 'ABSENT' || kind === 'ABSENT') {
      return { label: 'غائب', bg: colors.absentLight, color: colors.absent };
    }
    if (status === 'EXCUSED' || kind === 'EXCUSED') {
      return { label: 'معتذر', bg: colors.excusedLight, color: colors.excused };
    }
    return { label: 'حاضر', bg: colors.presentLight, color: colors.present };
  };

  const formatScanTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const formatNotificationDate = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('ar-EG', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const renderAttendanceDetails = (notifData: AttendanceNotificationData) => {
    const badgeCfg = getAttendanceBadgeConfig(notifData);
    const formattedScanTime = formatScanTime(notifData.scannedAt);
    const teacherAndSubject = [notifData.teacherName, notifData.subject].filter(Boolean).join(' • ');

    return (
      <View style={styles.attendanceContainer}>
        {/* Badges Row */}
        <View style={styles.badgeRow}>
          {notifData.isCorrection && (
            <View style={styles.correctionBadge}>
              <RotateCcw size={10} color={colors.warningDark} style={styles.correctionIcon} />
              <Text style={styles.correctionBadgeText}>[تصحيح]</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: badgeCfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: badgeCfg.color }]}>
              {badgeCfg.label}
            </Text>
          </View>
        </View>

        {/* Structured Meta Box */}
        {(formattedScanTime || teacherAndSubject || notifData.groupName || notifData.relatedGroupName) ? (
          <View style={styles.metaBox}>
            {formattedScanTime ? (
              <View style={styles.metaRow}>
                <Clock size={12} color={colors.primary} />
                <Text style={styles.metaText}>
                  وقت الحضور الفعلي:{' '}
                  <Text style={styles.metaTextBold}>{formattedScanTime}</Text>
                </Text>
              </View>
            ) : null}

            {teacherAndSubject ? (
              <View style={styles.metaRow}>
                <User size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{teacherAndSubject}</Text>
              </View>
            ) : null}

            {notifData.groupName ? (
              <View style={styles.metaRow}>
                <Users size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{notifData.groupName}</Text>
              </View>
            ) : null}

            {notifData.relatedGroupName ? (
              <View style={styles.metaRow}>
                <BookOpen size={12} color={colors.compensation} />
                <Text style={styles.metaText}>
                  المجموعة البديلة:{' '}
                  <Text style={styles.metaTextBold}>{notifData.relatedGroupName}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
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
          renderItem={({ item }) => {
            const hasStructuredAttendance = !!item.data?.kind;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (!item.isRead) {
                    markReadMutation.mutate(item.id);
                  }
                  if (item.studentId) {
                    let initialTab: 'attendance' | 'exams' | 'financial' = 'attendance';
                    if (item.type === 'PAYMENT_RECORDED' || item.type === 'CYCLE_STARTED') {
                      initialTab = 'financial';
                    } else if (item.type === 'EXAM_RESULT') {
                      initialTab = 'exams';
                    }
                    navigation.navigate('ChildDetails', {
                      studentId: item.studentId,
                      studentName: item.studentName || '',
                      initialTab,
                    });
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
                      {renderNotificationIcon(item.type, item.data)}
                    </View>
                    <View style={styles.textWrapper}>
                      <Text style={styles.cardTitle}>{item.title}</Text>

                      {/* Structured Attendance Details (Active when data.kind is present) */}
                      {hasStructuredAttendance && item.data && renderAttendanceDetails(item.data)}

                      <Text style={styles.cardBody}>{item.body}</Text>
                      <Text style={styles.timeText}>
                        {formatNotificationDate(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
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

  // ─── Attendance Details & Badges ─────────────────────────────
  attendanceContainer: {
    width: '100%',
    marginTop: 6,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
  },
  correctionBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.warningLight,
  },
  correctionIcon: {
    marginLeft: 3,
  },
  correctionBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.warningDark,
  },
  metaBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
    width: '100%',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  metaTextBold: {
    fontFamily: typography.bold,
    color: colors.text,
  },
});
