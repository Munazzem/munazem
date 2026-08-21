import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
        {rightIcon && <View style={styles.rightIconWrapper}>{rightIcon}</View>}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          textAlign="right"
          {...props}
        />
        {leftIcon && <View style={styles.leftIconWrapper}>{leftIcon}</View>}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.sm,
    color: colors.text,
    textAlign: 'right',
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputWrapperError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight + '20',
  },
  input: {
    flex: 1,
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  rightIconWrapper: {
    marginLeft: spacing.sm,
  },
  leftIconWrapper: {
    marginRight: spacing.sm,
  },
  errorText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.xs,
    color: colors.danger,
    textAlign: 'right',
    marginTop: spacing.xxs,
  },
  helperText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xxs,
  },
});
