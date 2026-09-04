import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { ChevronLeft } from 'lucide-react-native';

interface SectionCardProps {
  icon?: React.ReactNode;
  title: string;
  ctaLabel?: string;
  onCta?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  headerBg?: string;
  /** If true, removes the bottom CTA divider */
  noCta?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  icon,
  title,
  ctaLabel,
  onCta,
  children,
  style,
  noCta = false,
}) => (
  <View style={[styles.card, style]}>
    {/* Header */}
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>

    {/* Content */}
    <View style={styles.content}>{children}</View>

    {/* CTA Footer */}
    {!noCta && ctaLabel && onCta && (
      <TouchableOpacity style={styles.cta} onPress={onCta} activeOpacity={0.7}>
        <ChevronLeft size={16} color={colors.primary} />
        <Text style={styles.ctaText}>{ctaLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  ctaText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.primary,
  },
});
