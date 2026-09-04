import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeApi } from '../../api/home.api';
import { useAuthStore } from '../../store/auth.store';
import { useChildStore } from '../../store/child.store';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { SectionCard } from '../../components/common/SectionCard';
import { RootStackParamList } from '../../navigation/types';
import { formatArabicDateToday } from '../../utils/date.util';
import { TeacherTabs } from '../../components/common/TeacherTabs';
import { useActiveChild } from '../../hooks/useActiveChild';
import {
  CalendarCheck,
  Wallet,
  Award,
  BookOpen,
  Clock,
  Users,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';

const NavyHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={hdrStyles.wrap}>{children}</View>
);

const hdrStyles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const parent = useAuthStore((s) => s.parent);
  const {
    child,
    allChildren,
    subjects,
    activeSubject,
    selectedSubjectId,
    setSelectedSubjectId,
    isLoading,
    refetch,
    isRefetching,
  } = useActiveChild();

  const handleSwitchChild = useCallback(() => {
    if (allChildren && allChildren.length > 1) {
      navigation.navigate('SelectChild', { children: allChildren, mode: 'switch' });
    }
  }, [allChildren, navigation]);

  const canSwitch = (allChildren?.length ?? 0) > 1;

  // Derived values from active subject / teacher strictly
  const attendanceRate = activeSubject?.attendanceRate ?? 0;
  const presentCount = activeSubject?.presentCount ?? 0;
  const absentCount = activeSubject?.absentCount ?? 0;
  const excusedCount = activeSubject?.excusedCount ?? 0;
  const guestCount = activeSubject?.guestCount ?? 0;
  const hasDebt = activeSubject?.financialSummary ? activeSubject.financialSummary.hasOutstandingDebt : false;
  const remaining = activeSubject?.financialSummary ? activeSubject.financialSummary.remainingAmount : 0;
  // Strictly display this teacher's latest exam - DO NOT fall back to child.latestExam from another teacher!
  const displayExam = activeSubject?.latestExam ?? null;
  const latestExamScore = displayExam && displayExam.totalMarks ? Math.round((displayExam.score / displayExam.totalMarks) * 100) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.skyBlue}
              colors={[colors.skyBlue]}
            />
          }
        >
          {/* ── Navy Header ────────────────────────────────────────────── */}
          <NavyHeader>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <Text style={styles.dateText}>{formatArabicDateToday()}</Text>
              <Text style={styles.greeting}>
                أهلاً، {parent?.name?.split(' ')[0] ?? 'ولي الأمر'} 👋
              </Text>
            </View>

            {/* Student Chip */}
            {isLoading && !child ? (
              <View style={styles.studentChipSkeleton}>
                <ActivityIndicator size="small" color={colors.skyBlue} />
              </View>
            ) : child ? (
              <TouchableOpacity
                style={styles.studentChip}
                onPress={canSwitch ? handleSwitchChild : undefined}
                activeOpacity={canSwitch ? 0.75 : 1}
              >
                <View style={styles.chipLeft}>
                  <View style={styles.chipAvatar}>
                    <Text style={styles.chipAvatarText}>{child.studentName.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={styles.chipName}>{child.studentName}</Text>
                    <Text style={styles.chipGrade}>{child.gradeLevel}</Text>
                  </View>
                </View>
                {canSwitch && (
                  <View style={styles.switchBadge}>
                    <Users size={13} color={colors.skyBlue} />
                    <Text style={styles.switchText}>تبديل</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Teacher Tabs when enrolled with multiple teachers */}
            {subjects.length > 1 && (
              <TeacherTabs
                subjects={subjects}
                selectedSubjectId={activeSubject?.studentId ?? null}
                onSelect={(studentId) => setSelectedSubjectId(studentId)}
                variant="navy"
              />
            )}
          </NavyHeader>

          {/* ── Content Cards ──────────────────────────────────────────── */}
          <View style={styles.cards}>

            {/* Loading State */}
            {isLoading && !child ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>جاري تحميل بيانات الطالب...</Text>
              </View>
            ) : child ? (
              <>
                {/* ── Attendance Card ──────────────────────────────── */}
                <SectionCard
                  icon={<CalendarCheck size={18} color={colors.primary} />}
                  title="متابعة الغياب والحضور"
                  ctaLabel="عرض سجل الحضور"
                  onCta={() => navigation.navigate('MainTabs', { screen: 'AttendanceTab' } as any)}
                >
                  {activeSubject ? (
                    <TouchableOpacity
                      style={styles.attendanceSimpleRow}
                      onPress={() => navigation.navigate('MainTabs', { screen: 'AttendanceTab' } as any)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.attendanceSimpleLabel}>
                        <BookOpen size={13} color={colors.textMuted} />
                        <Text style={styles.attendanceSimpleLabelText}>
                          {activeSubject.subject} (أ. {activeSubject.teacherName})
                        </Text>
                      </View>
                      <View style={styles.attendanceSimpleBadge}>
                        <Text style={styles.attendanceSimpleBadgeText}>سجل الحصص</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.attendanceSimpleRow}
                      onPress={() => navigation.navigate('MainTabs', { screen: 'AttendanceTab' } as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.attendanceSimpleDesc}>
                        اضغط للاطلاع على سجل الحصص والغياب والحصص التعويضية
                      </Text>
                    </TouchableOpacity>
                  )}
                </SectionCard>

                {/* ── Finance Card ─────────────────────────────────── */}
                <SectionCard
                  icon={<Wallet size={18} color={hasDebt ? colors.absent : colors.present} />}
                  title="المالية"
                  ctaLabel="عرض التفاصيل"
                  onCta={() =>
                    navigation.navigate('FinanceDetail', {
                      studentId: activeSubject?.studentId ?? child.id,
                      studentName: child.studentName,
                    })
                  }
                >
                  {subjects.length > 1 ? (
                    <View style={styles.financeRow}>
                      <View style={styles.financeLabel}>
                        <BookOpen size={13} color={colors.textMuted} />
                        <Text style={styles.financeLabelText}>
                          {activeSubject?.subject ?? 'المادة'} (أ. {activeSubject?.teacherName ?? 'المعلم'})
                        </Text>
                      </View>
                      <View style={[styles.debtBadge, { backgroundColor: hasDebt ? colors.absentLight : colors.presentLight }]}>
                        <Text style={[styles.debtText, { color: hasDebt ? colors.absent : colors.present }]}>
                          {hasDebt ? `متبقي ${remaining} ج` : 'مدفوع ✓'}
                        </Text>
                      </View>
                    </View>
                  ) : child.subjects?.map((subj, i) => (
                    <View key={i} style={styles.financeRow}>
                      <View style={styles.financeLabel}>
                        <BookOpen size={13} color={colors.textMuted} />
                        <Text style={styles.financeLabelText}>{subj.subject}</Text>
                      </View>
                      <View style={[styles.debtBadge, { backgroundColor: hasDebt ? colors.absentLight : colors.presentLight }]}>
                        <Text style={[styles.debtText, { color: hasDebt ? colors.absent : colors.present }]}>
                          {hasDebt ? `متبقي ${remaining} ج` : 'مدفوع ✓'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!child.subjects || child.subjects.length === 0) && (
                    <View style={styles.financeRow}>
                      <View style={[styles.debtBadge, { backgroundColor: hasDebt ? colors.absentLight : colors.presentLight }]}>
                        <Text style={[styles.debtText, { color: hasDebt ? colors.absent : colors.present }]}>
                          {hasDebt ? `متبقي ${remaining} ج` : 'الاشتراكات سارية ✓'}
                        </Text>
                      </View>
                    </View>
                  )}
                </SectionCard>

                {/* ── Grades Card ──────────────────────────────────── */}
                <SectionCard
                  icon={<Award size={18} color={colors.royalBlue} />}
                  title="الدرجات"
                  ctaLabel="عرض كل الدرجات"
                  onCta={() => navigation.navigate('MainTabs', { screen: 'GradesTab' } as any)}
                >
                  {displayExam ? (
                    <View style={styles.gradeWrap}>
                      <View style={styles.gradeLeft}>
                        <Text style={styles.gradeExamTitle}>{displayExam.title}</Text>
                        <Text style={styles.gradeSubject}>
                          {displayExam.subject || activeSubject?.subject} (أ. {displayExam.teacherName || activeSubject?.teacherName})
                        </Text>
                      </View>
                      <View style={styles.gradeRight}>
                        <Text style={[
                          styles.gradeScore,
                          { color: latestExamScore && latestExamScore >= 60 ? colors.present : colors.absent },
                        ]}>
                          {displayExam.score}/{displayExam.totalMarks}
                        </Text>
                        <View style={styles.gradePerf}>
                          {latestExamScore && latestExamScore >= 75 ? (
                            <TrendingUp size={14} color={colors.present} />
                          ) : latestExamScore && latestExamScore >= 50 ? (
                            <Minus size={14} color={colors.warning} />
                          ) : (
                            <TrendingDown size={14} color={colors.absent} />
                          )}
                          <Text style={styles.gradePct}>{latestExamScore ?? 0}%</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>لا توجد اختبارات مسجلة بعد</Text>
                  )}
                </SectionCard>

                {/* ── Next Lesson Card ─────────────────────────────── */}
                {child.subjects?.length > 0 && (
                  <View style={styles.nextLesson}>
                    <View style={styles.nextLessonLeft}>
                      <Clock size={16} color={colors.skyBlue} />
                    </View>
                    <View style={styles.nextLessonInfo}>
                      <Text style={styles.nextLessonLabel}>الحصة القادمة</Text>
                      <Text style={styles.nextLessonSubject}>
                        {(activeSubject?.subject || child.subjects[0]?.subject)} — {(activeSubject?.teacherName ? `أ. ${activeSubject.teacherName}` : child.subjects[0]?.teacherName)}
                      </Text>

                    </View>
                  </View>
                )}
              </>
            ) : (
              /* Empty State */
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <RefreshCw size={36} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>لم يتم تحديد طالب بعد</Text>
                <Text style={styles.emptyDesc}>
                  امسح كارت الطالب أو أدخل رقم الهاتف المسجل لبدء المتابعة
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  scroll: {
    paddingBottom: 110,
    backgroundColor: colors.background,
  },
  // Top Bar
  topBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  greeting: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.textInverse,
  },
  dateText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
  },
  // Student Chip
  studentChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navyMid,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.navyLight,
  },
  studentChipSkeleton: {
    height: 68,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  chipAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56,189,248,0.15)',
    borderWidth: 2,
    borderColor: colors.skyBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontFamily: typography.extraBold,
    fontSize: 20,
    color: colors.skyBlue,
  },
  chipName: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: colors.textInverse,
    textAlign: 'right',
  },
  chipGrade: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 2,
  },
  switchBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.skyBlueFaint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
  },
  switchText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.skyBlue,
  },
  // Cards area
  cards: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.background,
  },
  // Attendance
  attendanceSimpleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  attendanceSimpleLabel: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  attendanceSimpleLabelText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  attendanceSimpleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  attendanceSimpleBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  attendanceSimpleDesc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
  },
  // Finance
  financeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  financeLabel: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  financeLabelText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  debtBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  debtText: {
    fontFamily: typography.bold,
    fontSize: 12,
  },
  // Grades
  gradeWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradeLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  gradeExamTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
  },
  gradeSubject: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  gradeRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  gradeScore: {
    fontFamily: typography.extraBold,
    fontSize: 22,
  },
  gradePerf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  gradePct: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Next Lesson
  nextLesson: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    ...shadows.sm,
  },
  nextLessonLeft: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLessonInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nextLessonLabel: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.skyBlue,
    textAlign: 'right',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  nextLessonSubject: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: 'right',
    marginTop: 2,
  },
  nextLessonTime: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  // Loading
  loadingWrap: {
    paddingVertical: spacing.huge,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Empty
  emptyWrap: {
    paddingVertical: spacing.huge,
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
  },
  // Teacher Tabs
  teacherTabsWrapper: {
    marginTop: spacing.md,
  },
  teacherTabsTitle: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
    marginBottom: spacing.xs,
  },
  teacherTabsScroll: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  teacherTab: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    minWidth: 110,
  },
  teacherTabActive: {
    backgroundColor: colors.skyBlue,
    borderColor: colors.skyBlue,
    ...shadows.sm,
  },
  teacherTabName: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  teacherTabNameActive: {
    color: colors.navy,
  },
  teacherTabSub: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  teacherTabSubActive: {
    color: 'rgba(15, 23, 42, 0.8)',
  },
});
