import React, { useMemo } from 'react';
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
import { CalendarCheck, Clock, UserCheck, UserX, AlertCircle, RefreshCw } from 'lucide-react-native';

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

  // Group records by cycle with start month
  const cycleGroups = useMemo(() => {
    const map = new Map<string, { label: string; records: AttendanceRecord[]; present: number; total: number }>();
    for (const rec of records) {
      const key = rec.cycleLabel || (rec.cycleNumber ? `دورة ${rec.cycleNumber}` : 'سجل الحضور');
      if (!map.has(key)) {
        map.set(key, { label: key, records: [], present: 0, total: 0 });
      }
      const grp = map.get(key)!;
      grp.records.push(rec);
      grp.total += 1;
      if (rec.status === 'PRESENT' || rec.status === 'LATE' || rec.status === 'GUEST' || rec.status === 'EXCUSED') {
        grp.present += 1;
      }
    }
    return Array.from(map.values());
  }, [records]);

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
                {activeSubject ? ((activeSubject as any).isPackage ? ' — باقة السنتر' : (activeSubject.teacherName?.startsWith('أ.') ? ` — ${activeSubject.teacherName}` : ` — أ. ${activeSubject.teacherName}`)) : ''}
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

          {/* Summary Stats Tab Bar */}
          <View style={styles.statsTabBar}>
            <View style={styles.statTabItem}>
              <Text style={[styles.statTabVal, { color: colors.present }]}>{present}</Text>
              <Text style={styles.statTabLbl}>حاضر</Text>
            </View>
            <View style={styles.statTabDivider} />
            <View style={styles.statTabItem}>
              <Text style={[styles.statTabVal, { color: colors.absent }]}>{absent}</Text>
              <Text style={styles.statTabLbl}>غائب</Text>
            </View>
            <View style={styles.statTabDivider} />
            <View style={styles.statTabItem}>
              <Text style={[styles.statTabVal, { color: colors.excused }]}>{excused}</Text>
              <Text style={styles.statTabLbl}>معوض</Text>
            </View>
            <View style={styles.statTabDivider} />
            <View style={styles.statTabItem}>
              <Text style={[styles.statTabVal, { color: colors.warning }]}>{guest}</Text>
              <Text style={styles.statTabLbl}>زائر</Text>
            </View>
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

          {/* Timeline Grouped by Cycles */}
          <Text style={styles.sectionTitle}>سجل الحصص والدورات</Text>
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
            cycleGroups.map((group, gIdx) => (
              <View key={gIdx} style={styles.cycleCard}>
                <View style={styles.cycleHeader}>
                  <Text style={styles.cycleTitle}>{group.label}</Text>
                  <View style={styles.cycleBadge}>
                    <Text style={styles.cycleBadgeText}>
                      حضر {group.present} من {group.total}
                    </Text>
                  </View>
                </View>
                <View style={styles.cycleList}>
                  {group.records.map((rec, i) => (
                    <AttendanceRow key={rec.id} record={rec} isLast={i === group.records.length - 1} />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

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
        {!!record.time && (
          <View style={rowStyles.timeRow}>
            <Clock size={12} color="#0f4c81" />
            <Text style={rowStyles.timeText}>الحضور بالظبط: {record.time}</Text>
          </View>
        )}
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
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 110, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: typography.extraBold,
    fontSize: 26,
    color: '#ffffff',
  },
  headerSub: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: '#93c5fd',
    marginTop: 2,
  },
  tabsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: spacing.sm,
  },
  statsTabBar: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  statTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTabDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
  statTabVal: {
    fontFamily: typography.extraBold,
    fontSize: 20,
    lineHeight: 24,
  },
  statTabLbl: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#1e3a6e',
    marginTop: 2,
  },
  rateCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
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
  },
  rateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rateValue: { fontFamily: typography.extraBold, fontSize: 32 },
  rateLabel: { fontFamily: typography.bold, fontSize: 14, color: '#1e3a6e' },
  barBg: {
    height: 8,
    backgroundColor: '#cbdcf0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  sectionTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'right',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cycleCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cycleHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cycleTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#0b2344',
  },
  cycleBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cycleBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0f4c81',
  },
  cycleList: {
    backgroundColor: colors.card,
  },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: typography.medium, fontSize: 14, color: '#93c5fd' },
});

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  info: { flex: 1, alignItems: 'flex-end' },
  subject: { fontFamily: typography.bold, fontSize: 14, color: '#0f172a' },
  teacher: { fontFamily: typography.regular, fontSize: 12, color: '#64748b', marginTop: 2 },
  timeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0f4c81',
  },
  notes: { fontFamily: typography.regular, fontSize: 11, color: '#0f4c81', marginTop: 3 },
  date: { fontFamily: typography.medium, fontSize: 12, color: '#64748b' },
});

