import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginVertical: spacing.xl,
  },
  iconWrapper: {
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.fontSize.lg,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: typography.fontFamily.regular,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.lineHeight.md,
    marginBottom: spacing.lg,
  },
  button: {
    minWidth: 160,
  },
});
