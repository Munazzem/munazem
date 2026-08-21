import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

export interface BadgeProps {
  label: string;
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  style,
  icon,
}) => {
  return (
    <View style={[styles.base, styles[variant], style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.text, styles[`text_${variant}`]]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  iconWrapper: {
    marginRight: spacing.xs,
  },
  text: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.xs,
  },

  // Variants
  success: {
    backgroundColor: colors.successLight,
  },
  danger: {
    backgroundColor: colors.dangerLight,
  },
  warning: {
    backgroundColor: colors.warningLight,
  },
  info: {
    backgroundColor: colors.infoLight,
  },
  neutral: {
    backgroundColor: colors.surface,
  },

  // Text Colors
  text_success: {
    color: colors.successDark,
  },
  text_danger: {
    color: colors.dangerDark,
  },
  text_warning: {
    color: colors.warningDark,
  },
  text_info: {
    color: colors.info,
  },
  text_neutral: {
    color: colors.textSecondary,
  },
});
