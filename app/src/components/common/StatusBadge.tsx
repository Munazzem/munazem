import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

export type AttendanceStatusType = 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE' | 'COMPENSATION' | 'GUEST';
export type FinancialStatusType = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';

type StatusType = AttendanceStatusType | FinancialStatusType;

const ATTENDANCE_CONFIG: Record<AttendanceStatusType, { label: string; bg: string; color: string }> = {
  PRESENT:      { label: 'حاضر',    bg: colors.presentLight,      color: colors.present },
  ABSENT:       { label: 'غائب',    bg: colors.absentLight,       color: colors.absent },
  EXCUSED:      { label: 'معوض',   bg: colors.excusedLight,      color: colors.excused },
  LATE:         { label: 'متأخر',   bg: colors.warningLight,      color: colors.warning },
  COMPENSATION: { label: 'تعويض',  bg: colors.compensationLight, color: colors.compensation },
  GUEST:        { label: 'زائر',    bg: colors.warningLight,      color: colors.warning },
};

const FINANCIAL_CONFIG: Record<FinancialStatusType, { label: string; bg: string; color: string }> = {
  PAID:          { label: 'مدفوع',         bg: colors.presentLight,  color: colors.present },
  PARTIALLY_PAID:{ label: 'مدفوع جزئياً',  bg: colors.warningLight,  color: colors.warning },
  UNPAID:        { label: 'غير مدفوع',     bg: colors.absentLight,   color: colors.absent },
};

const CONFIG = { ...ATTENDANCE_CONFIG, ...FINANCIAL_CONFIG };

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const cfg = CONFIG[status as keyof typeof CONFIG] ?? {
    label: status,
    bg: colors.surface,
    color: colors.textSecondary,
  };

  return (
    <View style={[
      styles.badge,
      { backgroundColor: cfg.bg },
      size === 'sm' && styles.badgeSm,
    ]}>
      <Text style={[
        styles.label,
        { color: cfg.color },
        size === 'sm' && styles.labelSm,
      ]}>
        {cfg.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    fontFamily: typography.bold,
    fontSize: 13,
    textAlign: 'center',
  },
  labelSm: {
    fontSize: 11,
  },
});
