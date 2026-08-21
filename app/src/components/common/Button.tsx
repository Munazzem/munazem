import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
  View,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  ...props
}) => {
  const isInteractive = !disabled && !loading;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={!isInteractive}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.textInverse}
          size="small"
        />
      ) : (
        <View style={styles.innerContent}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              styles.textBase,
              styles[`text_${variant}`],
              styles[`textSize_${size}`],
              disabled && styles.textDisabled,
              textStyle,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  innerContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  size_sm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 38,
  },
  size_md: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  size_lg: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minHeight: 54,
  },

  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },

  // Texts
  textBase: {
    fontFamily: typography.bold,
    textAlign: 'center',
  },
  textSize_sm: {
    fontSize: typography.fontSize.xs,
  },
  textSize_md: {
    fontSize: typography.fontSize.sm,
  },
  textSize_lg: {
    fontSize: typography.fontSize.md,
  },

  text_primary: {
    color: colors.textInverse,
  },
  text_secondary: {
    color: colors.text,
  },
  text_outline: {
    color: colors.primary,
  },
  text_danger: {
    color: colors.textInverse,
  },
  text_ghost: {
    color: colors.primary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
});
