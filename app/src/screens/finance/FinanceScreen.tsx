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
import { getArabicMonthName } from '../../utils/date.util';

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

  const totalPaid     = records.reduce((s, r) => s + r.totalPaid, 0);
  const totalDiscount = records.reduce((s, r) => s + (r.totalDiscount || 0), 0);
  const totalRemain   = records.reduce((s, r) => s + r.remainingAmount, 0);
  const hasDebt       = totalRemain > 0;
  const hasDiscount   = totalDiscount > 0;

  // Collect unique payments from records for this teacher, sorted by date desc
  const paymentMap = new Map<string, any>();
  records.forEach((r) => {
    r.payments?.forEach((p) => {
      if (!paymentMap.has(p.id)) {
        paymentMap.set(p.id, { ...p, subject: r.subject, teacher: r.teacherName });
      }
    });
  });
  const allPayments = Array.from(paymentMap.values())
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
              {activeSubject ? ((activeSubject as any).isPackage ? ' — باقة السنتر' : (activeSubject.teacherName?.startsWith('أ.') ? ` — ${activeSubject.teacherName}` : ` — أ. ${activeSubject.teacherName}`)) : ''}
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
              <Text style={[s.summaryValue, hasDiscount && s.summaryValueSm, { color: colors.present }]}>{totalPaid} ج</Text>
              <Text style={s.summaryLabel}>إجمالي المدفوع</Text>
            </View>
            {hasDiscount && (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={[s.summaryValue, s.summaryValueSm, { color: colors.warning }]}>{totalDiscount} ج</Text>
                  <Text style={s.summaryLabel}>إجمالي الخصم</Text>
                </View>
              </>
            )}
            {hasDebt && (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryItem}>
                  <Text style={[s.summaryValue, hasDiscount && s.summaryValueSm, { color: colors.absent }]}>
                    {totalRemain} ج
                  </Text>
                  <Text style={s.summaryLabel}>إجمالي المتبقي</Text>
                </View>
              </>
            )}
            <View style={s.statusIcon}>
              {hasDebt
                ? <AlertTriangle size={hasDiscount ? 24 : 30} color={colors.absent} />
                : <CheckCircle2 size={hasDiscount ? 24 : 30} color={colors.present} />}
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
                <Receipt size={18} color="#ffffff" />
                <Text style={s.sectionTitle}>سجل الدفعات</Text>
              </View>
              <View style={s.histCard}>
                {allPayments.map((p, i) => (
                  <View key={p.id} style={[s.payRow, i < allPayments.length - 1 && s.payBorder]}>
                    <View style={s.payRight}>
                      <Text style={s.payAmount}>{p.amount} ج</Text>
                      <View style={s.payBadgesRow}>
                        <View style={[s.payBadge, { backgroundColor: colors.presentLight }]}>
                          <Text style={[s.payBadgeText, { color: colors.present }]}>مدفوع</Text>
                        </View>
                        {(p.discount || 0) > 0 && (
                          <View style={[s.payBadge, { backgroundColor: colors.warningLight }]}>
                            <Text style={[s.payBadgeText, { color: colors.warningDark }]}>خصم: {p.discount} ج</Text>
                          </View>
                        )}
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

const getCycleMonthLabel = (record: FinancialRecord): string => {
  if (record.cycleMonth) {
    return record.cycleMonth.includes('شهر') ? record.cycleMonth : `شهر ${record.cycleMonth}`;
  }
  if (record.payments && record.payments.length > 0 && record.payments[0].date) {
    const month = getArabicMonthName(record.payments[0].date);
    if (month) return `شهر ${month}`;
  }
  return '';
};

// Cycle card WITHOUT payment history (moved to unified section)
const CycleCard: React.FC<{ record: FinancialRecord }> = ({ record }) => {
  const monthLabel = getCycleMonthLabel(record);

  return (
    <View style={c.container}>
      <View style={c.header}>
        <StatusBadge status={record.status} size="sm" />
        <View style={c.titleWrap}>
          <Text style={c.subject}>
            الدورة {record.cycleNumber} ({monthLabel || record.subject})
          </Text>
          <Text style={c.teacher}>
            {record.teacherName}{record.subject && monthLabel ? ` • ${record.subject}` : ''}
          </Text>
        </View>
      </View>

      {/* Cycle stats */}
      <View style={c.infoRow}>
        <InfoItem label="حصص الدورة" value={String(record.cycleCapacity)} />
        <InfoItem label="مستهلك" value={String(record.sessionsConsumed)} />
        <InfoItem label="سعر الدورة" value={`${record.fullCyclePrice} ج`} />
      </View>

      {/* Paid / Remaining / Discount chips */}
      <View style={c.finRow}>
        <View style={[c.chip, { backgroundColor: colors.presentLight }]}>
          <Text style={[c.chipText, { color: colors.present }]}>مدفوع: {record.totalPaid} ج</Text>
        </View>
        {(record.totalDiscount || 0) > 0 && (
          <View style={[c.chip, { backgroundColor: colors.warningLight }]}>
            <Text style={[c.chipText, { color: colors.warningDark }]}>خصم: {record.totalDiscount} ج</Text>
          </View>
        )}
        {record.remainingAmount > 0 && (
          <View style={[c.chip, { backgroundColor: colors.absentLight }]}>
            <Text style={[c.chipText, { color: colors.absent }]}>متبقي: {record.remainingAmount} ج</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={c.infoItem}>
    <Text style={c.infoValue}>{value}</Text>
    <Text style={c.infoLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 60, backgroundColor: colors.background },
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
  summaryCard: {
    flexDirection: 'row-reverse',
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
    borderWidth: 1.5,
    marginBottom: spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontFamily: typography.extraBold, fontSize: 24 },
  summaryValueSm: { fontSize: 18 },
  summaryLabel: { fontFamily: typography.bold, fontSize: 12, color: '#1e3a6e', marginTop: 2 },
  summaryDivider: { width: 1, height: 44, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  statusIcon: { marginLeft: spacing.md },
  sectionTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'right',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  histHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  histCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  payRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  payBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  payRight: { alignItems: 'flex-end', gap: 4 },
  payAmount: { fontFamily: typography.extraBold, fontSize: 17, color: colors.present },
  payBadgesRow: { flexDirection: 'row-reverse', gap: 4, alignItems: 'center' },
  payBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  payBadgeText: { fontFamily: typography.bold, fontSize: 11 },
  payLeft: { alignItems: 'flex-end' },
  paySubject: { fontFamily: typography.bold, fontSize: 13, color: '#0b2344' },
  payDateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, marginTop: 3 },
  payDate: { fontFamily: typography.regular, fontSize: 11, color: '#64748b' },
  center: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: typography.medium, fontSize: 14, color: '#93c5fd' },
});

const c = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  titleWrap: { alignItems: 'flex-end', flex: 1, marginRight: spacing.sm },
  subject: { fontFamily: typography.bold, fontSize: 15, color: '#0b2344' },
  teacher: { fontFamily: typography.regular, fontSize: 12, color: '#64748b', marginTop: 2 },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoItem: { alignItems: 'center', flex: 1 },
  infoValue: { fontFamily: typography.bold, fontSize: 16, color: '#0b2344' },
  infoLabel: { fontFamily: typography.medium, fontSize: 11, color: '#64748b', marginTop: 2 },
  finRow: { flexDirection: 'row-reverse', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  chipText: { fontFamily: typography.bold, fontSize: 12 },
});
