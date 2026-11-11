import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { ChevronLeft } from 'lucide-react-native';

interface SectionCardProps {
  icon?: React.ReactNode;
  title: string;
  ctaLabel?: string;
  onCta?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  headerBg?: string;
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
}) => {
  const Container = onCta ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, style]}
      onPress={onCta}
      activeOpacity={onCta ? 0.85 : 1}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text style={styles.title}>{title}</Text>
        </View>

        {!noCta && ctaLabel && onCta && (
          <View style={styles.headerCta}>
            <ChevronLeft size={13} color="#0f4c81" />
            <Text style={styles.headerCtaText}>{ctaLabel}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: 2,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: '#081a33',
  },
  headerCta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCtaText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: '#0a355c',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 2,
    paddingTop: 2,
  },
});
