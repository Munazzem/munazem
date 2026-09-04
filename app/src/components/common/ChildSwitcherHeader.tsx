import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { ChevronDown } from 'lucide-react-native';

interface ChildSwitcherHeaderProps {
  studentName: string;
  grade: string;
  canSwitch?: boolean;
  onSwitch?: () => void;
}

export const ChildSwitcherHeader: React.FC<ChildSwitcherHeaderProps> = ({
  studentName,
  grade,
  canSwitch = false,
  onSwitch,
}) => (
  <TouchableOpacity
    style={styles.container}
    onPress={canSwitch ? onSwitch : undefined}
    activeOpacity={canSwitch ? 0.7 : 1}
  >
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{studentName.charAt(0)}</Text>
    </View>
    <View style={styles.info}>
      <Text style={styles.name}>{studentName}</Text>
      <Text style={styles.grade}>{grade}</Text>
    </View>
    {canSwitch && <ChevronDown size={18} color={colors.textMuted} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.textInverse,
  },
  info: {
    alignItems: 'flex-end',
  },
  name: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: colors.primaryDark,
  },
  grade: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.primary,
    marginTop: 1,
  },
});
