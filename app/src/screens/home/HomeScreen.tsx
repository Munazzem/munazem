import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { HomeApi } from '../../api/home.api';
import { useAuthStore } from '../../store/auth.store';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentQrCardModal } from '../../components/common/StudentQrCardModal';
import { formatArabicDateToday } from '../../utils/date.util';
import { ChildCardSummary } from '../../types/child.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import {
  GraduationCap,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  CalendarCheck,
  Award,
  Wallet,
  ChevronLeft,
  QrCode as QrIcon,
} from 'lucide-react-native';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const parent = useAuthStore((state) => state.parent);
  const [selectedChildForQr, setSelectedChildForQr] = useState<any | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['family-overview'],
    queryFn: HomeApi.getFamilyOverview,
    staleTime: 1000 * 60 * 2, // 2 minutes stale time
  });

  const displayName = data?.parentName || parent?.name || 'ولي الأمر';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {/* Top Header & Greeting */}
        <View style={styles.header}>
          <View style={styles.greetingWrapper}>
            <Text style={styles.greeting}>
              أهلاً بك، {displayName} 👋
            </Text>
            <Text style={styles.dateText}>{formatArabicDateToday()}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.addBtn}
            onPress={() => {
              navigation.navigate('BarcodeScanner');
            }}
          >
            <PlusCircle size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>إضافة طالب</Text>
          </TouchableOpacity>
        </View>

        {/* Family Health & Alerts Card (The 3-Second Test) */}
        <Card variant="elevated" style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Text style={styles.overviewTitle}>حالة الأبناء اليوم</Text>
            {data?.healthStatus === 'NEEDS_ATTENTION' ? (
              <Badge label="تنبيه مهم" variant="danger" icon={<AlertTriangle size={14} color={colors.dangerDark} />} />
            ) : (
              <Badge label="الوضع مستقر ✓" variant="success" icon={<CheckCircle2 size={14} color={colors.successDark} />} />
            )}
          </View>

          <Text style={styles.overviewMessage}>
            {data?.alertMessage || 'جميع الأبناء منتظمون في حصصهم ولا توجد غيابات مسجلة اليوم.'}
          </Text>

          {/* Quick Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {isLoading && !data ? '...' : (data?.totalChildren ?? 0)}
              </Text>
              <Text style={styles.statLabel}>أبناء متابعين</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, data?.totalOutstandingDebt ? { color: colors.danger } : {}]}>
                {isLoading && !data
                  ? '...'
                  : data?.totalOutstandingDebt
                  ? `${data.totalOutstandingDebt} ج`
                  : 'سارية ✓'}
              </Text>
              <Text style={styles.statLabel}>الاشتراكات</Text>
            </View>
          </View>
        </Card>

        {/* Section: Children List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الأبناء المتابعون</Text>
        </View>

        {/* Children Render Logic */}
        {isLoading && !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>جاري تحميل بيانات الأبناء والامتحانات...</Text>
          </View>
        ) : data?.children && data.children.length > 0 ? (
          data.children.map((child: ChildCardSummary) => (
            <Card
              key={child.id}
              variant="elevated"
              style={styles.childCard}
              onPress={() =>
                navigation.navigate('ChildDetails', {
                  studentId: child.id,
                  studentName: child.studentName,
                })
              }
            >
              {/* Card Header */}
              <View style={styles.childHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.avatarText}>{child.studentName.charAt(0)}</Text>
                </View>
                <View style={styles.childNameWrapper}>
                  <Text style={styles.childName}>{child.studentName}</Text>
                  <Text style={styles.childGrade}>
                    {child.gradeLevel} • {child.subjectsCount} مواد
                  </Text>
                </View>

                {/* Quick QR Button */}
                <TouchableOpacity
                  style={styles.qrIconBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setSelectedChildForQr(child);
                  }}
                >
                  <QrIcon size={18} color={colors.primary} />
                  <Text style={styles.qrIconBtnText}>كارت الطالب</Text>
                </TouchableOpacity>

                <ChevronLeft size={20} color={colors.textMuted} />
              </View>

              {/* Quick Glance Metrics */}
              <View style={styles.metricsGrid}>
                {/* Attendance */}
                <View style={styles.metricItem}>
                  <CalendarCheck size={16} color={colors.success} />
                  <Text style={styles.metricText}>
                    حضور: {child.attendanceRate}%
                  </Text>
                </View>

                {/* Latest Exam */}
                <View style={styles.metricItem}>
                  <Award size={16} color={colors.primary} />
                  <Text style={styles.metricText}>
                    {child.latestExam
                      ? `${child.latestExam.score}/${child.latestExam.totalMarks}`
                      : 'لا امتحانات'}
                  </Text>
                </View>

                {/* Financial */}
                <View style={styles.metricItem}>
                  <Wallet size={16} color={child.financialSummary.hasOutstandingDebt ? colors.danger : colors.textSecondary} />
                  <Text style={styles.metricText}>
                    {child.financialSummary.hasOutstandingDebt
                      ? `${child.financialSummary.remainingAmount} ج`
                      : 'مدفوع ✓'}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            title="لم يتم ربط أي طالب بعد"
            description="امسح كارت الطالب لمتابعة الحضور والدرجات فوراً"
            icon={<GraduationCap size={48} color={colors.primary} />}
            actionTitle="مسح كارت الطالب"
            onAction={() => {
              navigation.navigate('BarcodeScanner');
            }}
          />
        )}
      </ScrollView>

      {/* Digital QR Card Modal */}
      <StudentQrCardModal
        visible={selectedChildForQr !== null}
        onClose={() => setSelectedChildForQr(null)}
        cardData={selectedChildForQr}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greetingWrapper: {
    alignItems: 'flex-end',
  },
  greeting: {
    ...textStyles.h2,
    color: colors.text,
  },
  dateText: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  overviewCard: {
    backgroundColor: colors.card,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  overviewHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  overviewTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
  },
  overviewMessage: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
  },
  statValue: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.text,
  },
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  childCard: {
    marginBottom: spacing.md,
  },
  childHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  avatarText: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.primary,
  },
  childNameWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  childName: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
  },
  childGrade: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  qrIconBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: spacing.sm,
  },
  qrIconBtnText: {
    fontFamily: typography.medium,
    fontSize: 11,
    color: colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: 12,
  },
  metricItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricText: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.text,
  },
});
