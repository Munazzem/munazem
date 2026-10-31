import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useChildStore } from '../../store/child.store';
import { ChildrenApi } from '../../api/children.api';
import { ExamRecord } from '../../types/child.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { TeacherTabs } from '../../components/common/TeacherTabs';
import { useActiveChild } from '../../hooks/useActiveChild';
import { Award, TrendingUp, TrendingDown, Minus, FileText } from 'lucide-react-native';

const FILTERS = [
  { key: 'exam', label: 'اختبارات' },
  { key: 'homework', label: 'واجبات' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

export const GradesScreen: React.FC = () => {
  const {
    child,
    subjects,
    activeSubject,
    activeStudentId,
    selectedSubjectId,
    setSelectedSubjectId,
  } = useActiveChild();

  const [filter, setFilter] = useState<FilterKey>('exam');

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['exams', activeStudentId],
    queryFn: () => ChildrenApi.getExams(activeStudentId, {}),
    enabled: !!activeStudentId,
  });

  const isHomework = (title: string) => {
    if (!title) return false;
    return /واجب|تسميع|شيت|تدريب|homework|assignment|sheet/i.test(title);
  };

  const examsList = records.filter((r) => !isHomework(r.title));
  const homeworkList = records.filter((r) => isHomework(r.title));

  const displayed = filter === 'exam' ? examsList : homeworkList;

  const currentList = displayed;
  const avgPct = currentList.length > 0
    ? Math.round(currentList.reduce((sum, r) => sum + r.percentage, 0) / currentList.length)
    : 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.skyBlue} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>الدرجات</Text>
            {child && (
              <Text style={styles.headerSub}>
                {child.studentName}
                {activeSubject ? ((activeSubject as any).isPackage ? ' — باقة السنتر' : (activeSubject.teacherName?.startsWith('أ.') ? ` — ${activeSubject.teacherName}` : ` — أ. ${activeSubject.teacherName}`)) : ''}
              </Text>
            )}
            {subjects.length > 1 && (
              <View style={styles.tabsWrap}>
                <TeacherTabs
                  subjects={subjects}
                  selectedSubjectId={activeSubject?.studentId ?? null}
                  onSelect={(id) => setSelectedSubjectId(id)}
                  variant="navy"
                />
              </View>
            )}
          </View>

          {/* Overall Average Card */}
          <View style={styles.avgCard}>
            <View style={styles.avgLeft}>
              <Text style={[
                styles.avgValue,
                {
                  color: currentList.length === 0
                    ? '#93c5fd'
                    : avgPct >= 75 ? colors.present : avgPct >= 50 ? colors.warning : colors.absent,
                },
              ]}>
                {currentList.length > 0 ? `${avgPct}%` : '—'}
              </Text>
              <Text style={styles.avgLabel}>
                {filter === 'exam' ? 'متوسط الاختبارات' : 'متوسط الواجبات'}
              </Text>
            </View>
            <View style={styles.avgRight}>
              <View style={[
                styles.perfBadge,
                {
                  backgroundColor: currentList.length === 0
                    ? 'rgba(147, 197, 253, 0.15)'
                    : avgPct >= 75 ? colors.presentLight : avgPct >= 50 ? colors.warningLight : colors.absentLight,
                },
              ]}>
                {currentList.length === 0 ? (
                  <Minus size={16} color="#93c5fd" />
                ) : avgPct >= 75 ? (
                  <TrendingUp size={16} color={colors.present} />
                ) : avgPct >= 50 ? (
                  <Minus size={16} color={colors.warning} />
                ) : (
                  <TrendingDown size={16} color={colors.absent} />
                )}
                <Text style={[
                  styles.perfLabel,
                  {
                    color: currentList.length === 0
                      ? '#93c5fd'
                      : avgPct >= 75 ? colors.present : avgPct >= 50 ? colors.warning : colors.absent,
                  },
                ]}>
                  {currentList.length === 0
                    ? 'لا توجد بيانات'
                    : avgPct >= 75 ? 'ممتاز' : avgPct >= 60 ? 'جيد' : avgPct >= 50 ? 'مقبول' : 'يحتاج جهد'}
                </Text>
              </View>
              <Text style={styles.totalCount}>
                {filter === 'exam' ? `${examsList.length} اختبار` : `${homeworkList.length} واجب`}
              </Text>
            </View>
          </View>

          {/* Filter Pills */}
          <View style={styles.filters}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.pill, filter === f.key && styles.pillActive]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Exam / Homework List */}
          {isLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#ffffff" /></View>
          ) : displayed.length === 0 ? (
            <View style={styles.emptyWrap}>
              <FileText size={40} color="#93c5fd" />
              <Text style={styles.emptyText}>
                {filter === 'exam' ? 'لا توجد اختبارات مسجلة بعد' : 'لا توجد واجبات مسجلة بعد'}
              </Text>
              <Text style={styles.emptySubText}>
                {filter === 'exam'
                  ? 'لم يتم رصد أي درجات اختبارات لهذا الطالب بعد'
                  : 'لم يتم رصد أي درجات واجبات لهذا الطالب بعد'}
              </Text>
            </View>
          ) : (
            <View style={styles.examCard}>
              {displayed.map((exam, i) => (
                <ExamRow key={exam.id} exam={exam} isLast={i === displayed.length - 1} />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const ExamRow: React.FC<{ exam: ExamRecord; isLast: boolean }> = ({ exam, isLast }) => {
  const dateStr = new Date(exam.date).toLocaleDateString('ar-EG', {
    day: 'numeric', month: 'short',
  });
  return (
    <View style={[rowStyles.container, !isLast && rowStyles.border]}>
      {/* Score Circle */}
      <View style={[
        rowStyles.circle,
        { borderColor: exam.passed ? colors.present : colors.absent },
      ]}>
        <Text style={[rowStyles.circleScore, { color: exam.passed ? colors.present : colors.absent }]}>
          {exam.score}
        </Text>
        <Text style={rowStyles.circleTotal}>/{exam.totalMarks}</Text>
      </View>

      {/* Info */}
      <View style={rowStyles.info}>
        <Text style={rowStyles.title}>{exam.title}</Text>
        <Text style={rowStyles.meta}>{exam.subject} • {exam.teacherName}</Text>
      </View>

      {/* Right: pct + date */}
      <View style={rowStyles.right}>
        <Text style={[rowStyles.pct, { color: exam.passed ? colors.present : colors.absent }]}>
          {exam.percentage}%
        </Text>
        <Text style={rowStyles.date}>{dateStr}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 110, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'flex-end',
  },
  headerTitle: { fontFamily: typography.extraBold, fontSize: 26, color: '#ffffff' },
  headerSub: { fontFamily: typography.medium, fontSize: 13, color: '#93c5fd', marginTop: 2 },
  tabsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: spacing.sm,
  },
  avgCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  avgLeft: { alignItems: 'flex-end' },
  avgValue: { fontFamily: typography.extraBold, fontSize: 40 },
  avgLabel: { fontFamily: typography.bold, fontSize: 14, color: '#1e3a6e', marginTop: 2 },
  avgRight: { alignItems: 'center', gap: spacing.sm },
  perfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  perfLabel: { fontFamily: typography.bold, fontSize: 12 },
  totalCount: { fontFamily: typography.regular, fontSize: 12, color: colors.textMuted },
  filters: {
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  pillText: { fontFamily: typography.medium, fontSize: 14, color: '#ffffff' },
  pillTextActive: { color: '#0b2344', fontFamily: typography.bold },
  examCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl },
  emptyText: { fontFamily: typography.bold, fontSize: 16, color: '#ffffff', textAlign: 'center' },
  emptySubText: { fontFamily: typography.regular, fontSize: 12, color: '#93c5fd', textAlign: 'center', marginTop: 4 },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.card,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  circleScore: { fontFamily: typography.extraBold, fontSize: 16 },
  circleTotal: { fontFamily: typography.regular, fontSize: 10, color: '#64748b' },
  info: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: typography.bold, fontSize: 14, color: '#0b2344' },
  meta: { fontFamily: typography.regular, fontSize: 12, color: '#64748b', marginTop: 2 },
  right: { alignItems: 'center', minWidth: 44 },
  pct: { fontFamily: typography.bold, fontSize: 15 },
  date: { fontFamily: typography.medium, fontSize: 11, color: '#64748b', marginTop: 2 },
});
