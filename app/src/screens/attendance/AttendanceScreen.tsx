import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useChildStore } from '../../store/child.store';
import { ChildrenApi } from '../../api/children.api';
import { AttendanceRecord } from '../../types/child.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TeacherTabs } from '../../components/common/TeacherTabs';
import { useActiveChild } from '../../hooks/useActiveChild';
import { CalendarCheck, UserCheck, UserX, AlertCircle, RefreshCw } from 'lucide-react-native';

export const AttendanceScreen: React.FC = () => {
  const {
    child,
    subjects,
    activeSubject,
    activeStudentId,
    selectedSubjectId,
    setSelectedSubjectId,
  } = useActiveChild();

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['attendance', activeStudentId],
    queryFn: () => ChildrenApi.getAttendance(activeStudentId, {}),
    enabled: !!activeStudentId,
  });

  const present  = records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent   = records.filter((r) => r.status === 'ABSENT').length;
  const excused  = records.filter((r) => r.status === 'EXCUSED').length;
  const guest    = records.filter((r) => r.status === 'GUEST').length;
  const total    = records.length;
  const attendedCount = present + guest + excused; // معوض = حضر تعويضاً → يُعدّ حاضراً
  const rate     = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

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
          {/* Navy Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>متابعة الغياب والحضور</Text>
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
                  onSelect={(studentId) => setSelectedSubjectId(studentId)}
                  variant="navy"
                />
              </View>
            )}
          </View>

          {/* Summary Stats */}
          <View style={styles.summaryGrid}>
            <StatBox label="حاضر" value={present} color={colors.present} bg={colors.presentLight} />
            <StatBox label="غائب" value={absent} color={colors.absent} bg={colors.absentLight} />
            <StatBox label="معوض" value={excused} color={colors.excused} bg={colors.excusedLight} />
            <StatBox label="زائر" value={guest} color={colors.warning} bg={colors.warningLight} />
          </View>

          {/* Rate Bar */}
          <View style={styles.rateCard}>
            <View style={styles.rateRow}>
              <Text style={[styles.rateValue, { color: rate >= 75 ? colors.present : colors.absent }]}>
                {rate}%
              </Text>
              <Text style={styles.rateLabel}>نسبة الحضور الإجمالية</Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${rate}%` as any,
                    backgroundColor: rate >= 75 ? colors.present : colors.absent,
                  },
                ]}
              />
            </View>
          </View>

          {/* Timeline */}
          <Text style={styles.sectionTitle}>سجل الحضور</Text>
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : records.length === 0 ? (
            <View style={styles.emptyWrap}>
              <CalendarCheck size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>لا توجد سجلات حضور بعد</Text>
            </View>
          ) : (
            records.map((rec, i) => <AttendanceRow key={rec.id} record={rec} isLast={i === records.length - 1} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const StatBox: React.FC<{ label: string; value: number; color: string; bg: string }> = ({
  label, value, color, bg,
}) => (
  <View style={[statStyles.box, { backgroundColor: bg }]}>
    <Text style={[statStyles.value, { color }]}>{value}</Text>
    <Text style={statStyles.label}>{label}</Text>
  </View>
);

const AttendanceRow: React.FC<{ record: AttendanceRecord; isLast: boolean }> = ({ record, isLast }) => {
  const dateStr = new Date(record.date).toLocaleDateString('ar-EG', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  return (
    <View style={[rowStyles.container, !isLast && rowStyles.border]}>
      <StatusBadge status={record.status as any} size="sm" />
      <View style={rowStyles.info}>
        <Text style={rowStyles.subject}>{record.subject}</Text>
        <Text style={rowStyles.teacher}>
          {record.teacherName}
          {record.groupName ? ` • ${record.groupName}` : ''}
        </Text>
        {!!record.notes && (
          <Text style={rowStyles.notes} numberOfLines={2}>{record.notes}</Text>
        )}
      </View>
      <Text style={rowStyles.date}>{dateStr}</Text>
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
  headerTitle: {
    fontFamily: typography.extraBold,
    fontSize: 26,
    color: colors.textInverse,
  },
  headerSub: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  tabsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  rateCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  rateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rateValue: { fontFamily: typography.extraBold, fontSize: 32 },
  rateLabel: { fontFamily: typography.medium, fontSize: 14, color: colors.textSecondary },
  barBg: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  sectionTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: typography.medium, fontSize: 14, color: colors.textMuted },
});

const statStyles = StyleSheet.create({
  box: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: 'center',
  },
  value: { fontFamily: typography.extraBold, fontSize: 22 },
  label: { fontFamily: typography.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  info: { flex: 1, alignItems: 'flex-end' },
  subject: { fontFamily: typography.bold, fontSize: 14, color: colors.text },
  teacher: { fontFamily: typography.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  notes: { fontFamily: typography.regular, fontSize: 11, color: colors.skyBlue, marginTop: 2 },
  date: { fontFamily: typography.medium, fontSize: 12, color: colors.textMuted },
});
