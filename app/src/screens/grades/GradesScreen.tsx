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
  { key: 'all', label: 'الكل' },
  { key: 'exam', label: 'اختبارات' },
  { key: 'quiz', label: 'كويزات' },
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

  const [filter, setFilter] = useState<FilterKey>('all');

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['exams', activeStudentId],
    queryFn: () => ChildrenApi.getExams(activeStudentId, {}),
    enabled: !!activeStudentId,
  });

  const avgPct = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + r.percentage, 0) / records.length)
    : 0;

  const displayed = records; // Could filter by type when backend supports it

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
                {activeSubject?.teacherName ? ` — أ. ${activeSubject.teacherName}` : ''}
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
                { color: avgPct >= 75 ? colors.present : avgPct >= 50 ? colors.warning : colors.absent },
              ]}>
                {avgPct}%
              </Text>
              <Text style={styles.avgLabel}>المتوسط العام</Text>
            </View>
            <View style={styles.avgRight}>
              <View style={[
                styles.perfBadge,
                { backgroundColor: avgPct >= 75 ? colors.presentLight : avgPct >= 50 ? colors.warningLight : colors.absentLight },
              ]}>
                {avgPct >= 75 ? <TrendingUp size={16} color={colors.present} /> :
                 avgPct >= 50 ? <Minus size={16} color={colors.warning} /> :
                 <TrendingDown size={16} color={colors.absent} />}
                <Text style={[
                  styles.perfLabel,
                  { color: avgPct >= 75 ? colors.present : avgPct >= 50 ? colors.warning : colors.absent },
                ]}>
                  {avgPct >= 75 ? 'ممتاز' : avgPct >= 60 ? 'جيد' : avgPct >= 50 ? 'مقبول' : 'يحتاج جهد'}
                </Text>
              </View>
              <Text style={styles.totalCount}>{records.length} اختبار</Text>
            </View>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.pill, filter === f.key && styles.pillActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.pillText, filter === f.key && styles.pillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Exam List */}
          {isLoading ? (
            <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : displayed.length === 0 ? (
            <View style={styles.emptyWrap}>
              <FileText size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد درجات مسجلة بعد</Text>
            </View>
          ) : (
            displayed.map((exam, i) => (
              <ExamRow key={exam.id} exam={exam} isLast={i === displayed.length - 1} />
            ))
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
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { paddingBottom: 110, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'flex-end',
  },
  headerTitle: { fontFamily: typography.extraBold, fontSize: 26, color: colors.textInverse },
  headerSub: { fontFamily: typography.regular, fontSize: 13, color: '#94a3b8', marginTop: 2 },
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
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  avgLeft: { alignItems: 'flex-end' },
  avgValue: { fontFamily: typography.extraBold, fontSize: 40 },
  avgLabel: { fontFamily: typography.medium, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  pillText: { fontFamily: typography.medium, fontSize: 13, color: colors.textSecondary },
  pillTextActive: { color: colors.primary },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: typography.medium, fontSize: 14, color: colors.textMuted },
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
  border: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  circleScore: { fontFamily: typography.extraBold, fontSize: 16 },
  circleTotal: { fontFamily: typography.regular, fontSize: 10, color: colors.textMuted },
  info: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: typography.bold, fontSize: 14, color: colors.text },
  meta: { fontFamily: typography.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  right: { alignItems: 'center', minWidth: 44 },
  pct: { fontFamily: typography.bold, fontSize: 15 },
  date: { fontFamily: typography.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
});
