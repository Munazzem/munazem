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
  Calendar,
  QrCode,
} from 'lucide-react-native';
import { StudentQrCardModal } from '../../components/common/StudentQrCardModal';

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

  const [qrModalVisible, setQrModalVisible] = useState(false);

  const primarySub = activeSubject || subjects[0];
  const cardData = child
    ? {
        studentId: activeSubject?.studentId || child.id,
        studentName: child.studentName || 'طالب',
        gradeLevel: child.gradeLevel || '',
        studentCode: activeSubject?.studentCode || child.studentCode || '',
        barcode: activeSubject?.barcode || child.barcode || '',
        qrValue:
          (activeSubject as any)?.qrValue ||
          activeSubject?.barcode ||
          child.barcode ||
          child.studentCode ||
          child.id,
        teacherName: activeSubject
          ? activeSubject.teacherName?.startsWith('أ.')
            ? activeSubject.teacherName
            : `أ. ${activeSubject.teacherName}`
          : primarySub?.teacherName || '',
        subject: activeSubject?.subject || primarySub?.subject || '',
        centerName: activeSubject?.centerName || primarySub?.centerName || '',
        groupName: activeSubject?.groupName || primarySub?.groupName || '',
      }
    : null;

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
              <View style={styles.dateBadge}>
                <Calendar size={13} color="#ffffff" />
                <Text style={styles.dateText}>{formatArabicDateToday()}</Text>
              </View>
              <View style={styles.greetingWrap}>
                <Text style={styles.greeting}>مرحباً ولي الأمر</Text>
                {parent?.name && parent.name !== 'ولي الأمر' ? (
                  <Text style={styles.greetingSub}>أ. {parent.name}</Text>
                ) : (
                  <Text style={styles.greetingSub}>متابعة شؤون الطلاب</Text>
                )}
              </View>
            </View>

            {/* Student Card */}
            {isLoading && !child ? (
              <View style={styles.studentChipSkeleton}>
                <ActivityIndicator size="small" color="#38bdf8" />
              </View>
            ) : child ? (
              <View style={styles.studentCard}>
                <TouchableOpacity
                  style={styles.studentInfoRow}
                  onPress={canSwitch ? handleSwitchChild : () => setQrModalVisible(true)}
                  activeOpacity={canSwitch ? 0.75 : 0.9}
                >
                  <View style={styles.chipAvatar}>
                    <Text style={styles.chipAvatarText}>{(child.studentName || 'ط').charAt(0)}</Text>
                  </View>
                  <View style={styles.chipInfo}>
                    <Text style={styles.chipName} numberOfLines={1}>{child.studentName || 'طالب'}</Text>
                    <Text style={styles.chipGrade} numberOfLines={1}>{child.gradeLevel || 'طالب مسجل'}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.studentActionsRow}>
                  <TouchableOpacity
                    style={styles.qrActionBtn}
                    onPress={() => setQrModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <QrCode size={15} color="#ffffff" />
                    <Text style={styles.qrActionBtnText}>كارت QR الطالب</Text>
                  </TouchableOpacity>

                  {canSwitch && (
                    <TouchableOpacity
                      style={styles.switchActionBtn}
                      onPress={handleSwitchChild}
                      activeOpacity={0.8}
                    >
                      <Users size={14} color="#38bdf8" />
                      <Text style={styles.switchActionBtnText}>تبديل الطالب</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
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
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>جاري تحميل بيانات الطالب...</Text>
              </View>
            ) : child ? (
              <>
                {/* ── Package Teachers Card (for Center Package Students) ── */}
                {((activeSubject as any)?.packageTeachers?.length > 0 || (child as any)?.packageTeachers?.length > 0) && (
                  <View style={styles.packageCardWrap}>
                    <View style={styles.packageCardHeader}>
                      <View style={styles.packageCardHeaderLeft}>
                        <Users size={16} color="#0f4c81" />
                        <Text style={styles.packageCardTitle}>معلمو الباقة بالسنتر</Text>
                      </View>
                      <Text style={styles.packageCardSubtitle}>
                        {(activeSubject as any)?.packageName || (child as any)?.packageName || 'الباقة التعليمية'}
                      </Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packageTeachersScroll}>
                      {((activeSubject as any)?.packageTeachers || (child as any)?.packageTeachers || []).map((tch: any, idx: number) => (
                        <View key={tch.id || idx} style={styles.packageTeacherItem}>
                          <View style={styles.packageTeacherAvatar}>
                            <Text style={styles.packageTeacherAvatarText}>{(tch.name || 'م').charAt(0)}</Text>
                          </View>
                          <View style={styles.packageTeacherInfo}>
                            <Text style={styles.packageTeacherName} numberOfLines={1}>أ. {tch.name}</Text>
                            <Text style={styles.packageTeacherSubject} numberOfLines={1}>{tch.subject || 'مادة دراسية'}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* ── Attendance Card ──────────────────────────────── */}
                <SectionCard
                  icon={<CalendarCheck size={17} color="#0f4c81" />}
                  title="متابعة الغياب والحضور"
                  ctaLabel="سجل الحصص"
                  onCta={() => navigation.navigate('MainTabs', { screen: 'AttendanceTab' } as any)}
                >
                  <View style={styles.cardSubjectRow}>
                    <BookOpen size={13} color="#0f4c81" />
                    <Text style={styles.cardSubjectText} numberOfLines={1}>
                      {(activeSubject as any)?.isPackage
                        ? `باقة السنتر (${(activeSubject as any)?.groupName || 'الباقة'})`
                        : `${activeSubject?.subject ?? 'المادة'} (أ. ${activeSubject?.teacherName ?? 'المعلم'})`}
                    </Text>
                  </View>

                  <View style={styles.statsTabBar}>
                    <View style={styles.statTabItem}>
                      <Text style={[styles.statTabVal, { color: '#16a34a' }]}>{presentCount}</Text>
                      <Text style={styles.statTabLbl}>حاضر</Text>
                    </View>
                    <View style={styles.statTabDivider} />
                    <View style={styles.statTabItem}>
                      <Text style={[styles.statTabVal, { color: '#dc2626' }]}>{absentCount}</Text>
                      <Text style={styles.statTabLbl}>غائب</Text>
                    </View>
                    <View style={styles.statTabDivider} />
                    <View style={styles.statTabItem}>
                      <Text style={[styles.statTabVal, { color: '#d97706' }]}>{excusedCount}</Text>
                      <Text style={styles.statTabLbl}>معوض</Text>
                    </View>
                    <View style={styles.statTabDivider} />
                    <View style={styles.statTabItem}>
                      <Text style={[styles.statTabVal, { color: '#0f4c81' }]}>{attendanceRate}%</Text>
                      <Text style={styles.statTabLbl}>النسبة</Text>
                    </View>
                  </View>
                </SectionCard>

                {/* ── Finance Card ─────────────────────────────────── */}
                <SectionCard
                  icon={<Wallet size={17} color={hasDebt && remaining > 0 ? '#dc2626' : '#0f4c81'} />}
                  title="المالية"
                  ctaLabel="التفاصيل"
                  onCta={() =>
                    navigation.navigate('FinanceDetail', {
                      studentId: (activeSubject as any)?.rawStudentId ?? activeSubject?.studentId ?? child.id,
                      studentName: child.studentName || 'طالب',
                    })
                  }
                >
                  <View style={styles.financeCompactRow}>
                    <View style={styles.cardSubjectRow}>
                      <BookOpen size={13} color="#0f4c81" />
                      <Text style={styles.cardSubjectText} numberOfLines={1}>
                        {(activeSubject as any)?.isPackage
                          ? `باقة السنتر (${(activeSubject as any)?.groupName || 'الباقة'})`
                          : `${activeSubject?.subject ?? 'المادة'} (أ. ${activeSubject?.teacherName ?? 'المعلم'})`}
                      </Text>
                    </View>
                    {hasDebt && remaining > 0 ? (
                      <View style={styles.debtPill}>
                        <Text style={styles.debtPillText}>متبقي {remaining} ج</Text>
                      </View>
                    ) : (
                      <View style={styles.paidPill}>
                        <Text style={styles.paidPillText}>خالص تماماً</Text>
                      </View>
                    )}
                  </View>
                </SectionCard>

                {/* ── Grades Card ──────────────────────────────────── */}
                <SectionCard
                  icon={<Award size={17} color="#d97706" />}
                  title="الدرجات"
                  ctaLabel="كل الدرجات"
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
                          { color: latestExamScore && latestExamScore >= 60 ? '#16a34a' : '#dc2626' },
                        ]}>
                          {displayExam.score}/{displayExam.totalMarks}
                        </Text>
                        <View style={styles.gradePerf}>
                          {latestExamScore && latestExamScore >= 75 ? (
                            <TrendingUp size={13} color="#16a34a" />
                          ) : latestExamScore && latestExamScore >= 50 ? (
                            <Minus size={13} color="#d97706" />
                          ) : (
                            <TrendingDown size={13} color="#dc2626" />
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
                      <Clock size={16} color="#0f4c81" />
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

      {/* Student QR Card Modal */}
      <StudentQrCardModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        cardData={cardData}
      />
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
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: 130,
    backgroundColor: colors.background,
  },
  // Top Bar
  topBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  greetingWrap: {
    alignItems: 'flex-end',
  },
  greeting: {
    fontFamily: typography.extraBold,
    fontSize: 22,
    color: '#ffffff',
    textAlign: 'right',
  },
  greetingSub: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: '#93c5fd',
    marginTop: 2,
    textAlign: 'right',
  },
  dateBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dateText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  // Student Card
  studentCard: {
    backgroundColor: '#102d57',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#1e4880',
    marginTop: spacing.xs,
    gap: 12,
  },
  studentChipSkeleton: {
    height: 104,
    borderRadius: 16,
    backgroundColor: '#102d57',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  studentInfoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
  },
  chipAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e3a6e',
    borderWidth: 2,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontFamily: typography.extraBold,
    fontSize: 20,
    color: '#ffffff',
  },
  chipInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  chipName: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: '#ffffff',
    textAlign: 'right',
  },
  chipGrade: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: '#93c5fd',
    textAlign: 'right',
    marginTop: 2,
  },
  studentActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  qrActionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f4c81',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  qrActionBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  switchActionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(56,189,248,0.14)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
  },
  switchActionBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#38bdf8',
  },
  // Cards area
  cards: {
    paddingHorizontal: spacing.md + 2,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  cardSubjectRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs + 2,
  },
  cardSubjectText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: '#1e3a6e',
    flex: 1,
    textAlign: 'right',
  },
  statsTabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  statTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  statTabDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.border,
  },
  statTabVal: {
    fontFamily: typography.extraBold,
    fontSize: 14,
    lineHeight: 18,
  },
  statTabLbl: {
    fontFamily: typography.bold,
    fontSize: 10,
    color: '#1e3a6e',
    marginTop: 1,
  },
  financeCompactRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  debtPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  debtPillText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#dc2626',
  },
  paidPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paidPillText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#16a34a',
  },
  // Grades
  gradeWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  gradeLeft: {
    flex: 1,
    alignItems: 'flex-end',
  },
  gradeExamTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#0b2344',
    textAlign: 'right',
  },
  gradeSubject: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  gradeRight: {
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  gradeScore: {
    fontFamily: typography.extraBold,
    fontSize: 20,
  },
  gradePerf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  gradePct: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#64748b',
  },
  emptyText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'right',
    paddingVertical: spacing.xs,
  },
  // Next Lesson
  nextLesson: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  nextLessonLeft: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextLessonInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nextLessonLabel: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0f4c81',
    textAlign: 'right',
  },
  nextLessonSubject: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#0b2344',
    textAlign: 'right',
    marginTop: 2,
  },
  nextLessonTime: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
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
    color: '#93c5fd',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: '#ffffff',
    textAlign: 'center',
  },
  emptyDesc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#93c5fd',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Package Teachers Card
  packageCardWrap: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  packageCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  packageCardHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
  },
  packageCardTitle: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: '#0b2344',
  },
  packageCardSubtitle: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0f4c81',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packageTeachersScroll: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  packageTeacherItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    minWidth: 130,
  },
  packageTeacherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageTeacherAvatarText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#0f4c81',
  },
  packageTeacherInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  packageTeacherName: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#0b2344',
  },
  packageTeacherSubject: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
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
