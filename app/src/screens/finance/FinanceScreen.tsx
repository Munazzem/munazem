import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ChildrenApi } from '../../api/children.api';
import { FinancialRecord } from '../../types/child.types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TeacherTabs } from '../../components/common/TeacherTabs';
import { useActiveChild } from '../../hooks/useActiveChild';
import { Wallet, CheckCircle2, AlertTriangle, Receipt, Calendar } from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'FinanceDetail'>;

export const FinanceScreen: React.FC<Props> = ({ route }) => {
  const { studentId: initialStudentId, studentName } = route.params;
  const {
    child,
    subjects,
    activeSubject,
    activeStudentId,
    selectedSubjectId,
    setSelectedSubjectId,
  } = useActiveChild();

  const queryStudentId = activeStudentId || initialStudentId;

  const { data: records = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['financial', queryStudentId],
    queryFn: () => ChildrenApi.getFinancial(queryStudentId, {}),
    enabled: !!queryStudentId,
  });

  const totalPaid   = records.reduce((s, r) => s + r.totalPaid, 0);
  const totalRemain = records.reduce((s, r) => s + r.remainingAmount, 0);
  const hasDebt     = totalRemain > 0;

  // Collect payments from records for this teacher, sorted by date desc
  const allPayments = records
    .flatMap((r) =>
      r.payments.map((p) => ({ ...p, subject: r.subject, teacher: r.teacherName }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.skyBlue} />}
        >
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>المالية</Text>
            <Text style={s.headerSub}>
              {child?.studentName ?? studentName}
              {activeSubject?.teacherName ? ` — أ. ${activeSubject.teacherName}` : ''}
            </Text>
            {subjects.length > 1 && (
              <View style={s.tabsWrap}>
                <TeacherTabs
                  subjects={subjects}
                  selectedSubjectId={activeSubject?.studentId ?? null}
                  onSelect={(id) => setSelectedSubjectId(id)}
                  variant="navy"
                />
              </View>
            )}
          </View>

          {/* Summary Bar */}
          <View style={[s.summaryCard, { borderColor: hasDebt ? colors.absentLight : colors.presentLight }]}>
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: colors.present }]}>{totalPaid} ج</Text>
              <Text style={s.summaryLabel}>إجمالي المدفوع</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: hasDebt ? colors.absent : colors.textMuted }]}>
                {totalRemain} ج
              </Text>
              <Text style={s.summaryLabel}>إجمالي المتبقي</Text>
            </View>
            <View style={s.statusIcon}>
              {hasDebt
                ? <AlertTriangle size={30} color={colors.absent} />
                : <CheckCircle2 size={30} color={colors.present} />}
            </View>
          </View>

          {/* Section: Cycles */}
          <Text style={s.sectionTitle}>تفاصيل الدورات</Text>
          {isLoading ? (
            <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : records.length === 0 ? (
            <View style={s.emptyWrap}>
              <Wallet size={40} color={colors.textMuted} />
              <Text style={s.emptyText}>لا توجد سجلات مالية بعد</Text>
            </View>
          ) : (
            records.map((rec, i) => <CycleCard key={i} record={rec} />)
          )}

          {/* Section: Payment History (unified, sorted) */}
          {allPayments.length > 0 && (
            <>
              <View style={s.histHeader}>
                <Receipt size={17} color={colors.primary} />
                <Text style={s.sectionTitle}>سجل الدفعات</Text>
              </View>
              <View style={s.histCard}>
                {allPayments.map((p, i) => (
                  <View key={p.id} style={[s.payRow, i < allPayments.length - 1 && s.payBorder]}>
                    <View style={s.payRight}>
                      <Text style={s.payAmount}>{p.amount} ج</Text>
                      <View style={[s.payBadge, { backgroundColor: colors.presentLight }]}>
                        <Text style={[s.payBadgeText, { color: colors.present }]}>مدفوع</Text>
                      </View>
                    </View>
                    <View style={s.payLeft}>
                      <Text style={s.paySubject}>{p.subject}</Text>
                      <View style={s.payDateRow}>
                        <Calendar size={11} color={colors.textMuted} />
                        <Text style={s.payDate}>
                          {new Date(p.date).toLocaleDateString('ar-EG', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// Cycle card WITHOUT payment history (moved to unified section)
const CycleCard: React.FC<{ record: FinancialRecord }> = ({ record }) => (
  <View style={c.container}>
    <View style={c.header}>
      <StatusBadge status={record.status} size="sm" />
      <View style={c.titleWrap}>
        <Text style={c.subject}>{record.subject}</Text>
        <Text style={c.teacher}>{record.teacherName}</Text>
      </View>
    </View>

    {/* Cycle stats */}
    <View style={c.infoRow}>
      <InfoItem label="حصص الدورة" value={String(record.cycleCapacity)} />
      <InfoItem label="مستهلك" value={String(record.sessionsConsumed)} />
      <InfoItem label="سعر الدورة" value={`${record.fullCyclePrice} ج`} />
    </View>

    {/* Paid / Remaining chips */}
    <View style={c.finRow}>
      <View style={[c.chip, { backgroundColor: colors.presentLight }]}>
        <Text style={[c.chipText, { color: colors.present }]}>مدفوع: {record.totalPaid} ج</Text>
      </View>
      {record.remainingAmount > 0 && (
        <View style={[c.chip, { backgroundColor: colors.absentLight }]}>
          <Text style={[c.chipText, { color: colors.absent }]}>متبقي: {record.remainingAmount} ج</Text>
        </View>
      )}
    </View>
  </View>
);

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={c.infoItem}>
    <Text style={c.infoValue}>{value}</Text>
    <Text style={c.infoLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { paddingBottom: 60, backgroundColor: colors.background },
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
  summaryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: typography.extraBold, fontSize: 24 },
  summaryLabel: { fontFamily: typography.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  summaryDivider: { width: 1, height: 44, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },
  statusIcon: { marginLeft: spacing.md },
  sectionTitle: {
    fontFamily: typography.bold, fontSize: 16, color: colors.text,
    textAlign: 'right', marginHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  histHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  histCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  payRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  payBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  payRight: { alignItems: 'flex-end', gap: 4 },
  payAmount: { fontFamily: typography.extraBold, fontSize: 17, color: colors.present },
  payBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  payBadgeText: { fontFamily: typography.bold, fontSize: 11 },
  payLeft: { alignItems: 'flex-end' },
  paySubject: { fontFamily: typography.bold, fontSize: 13, color: colors.text },
  payDateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 3 },
  payDate: { fontFamily: typography.regular, fontSize: 11, color: colors.textMuted },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: typography.medium, fontSize: 14, color: colors.textMuted },
});

const c = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  titleWrap: { alignItems: 'flex-end', flex: 1, marginRight: spacing.sm },
  subject: { fontFamily: typography.bold, fontSize: 15, color: colors.text },
  teacher: { fontFamily: typography.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoItem: { alignItems: 'center', flex: 1 },
  infoValue: { fontFamily: typography.bold, fontSize: 16, color: colors.text },
  infoLabel: { fontFamily: typography.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  finRow: { flexDirection: 'row-reverse', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  chipText: { fontFamily: typography.bold, fontSize: 12 },
});
