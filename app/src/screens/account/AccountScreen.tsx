import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { useAuthStore } from '../../store/auth.store';
import { AuthApi } from '../../api/auth.api';
import { User, Phone, Smartphone, LogOut, Shield } from 'lucide-react-native';

export const AccountScreen: React.FC = () => {
  const { parent, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج من هذا الجهاز؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await AuthApi.logout();
          await logout();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>حساب ولي الأمر</Text>
        </View>

        {/* Profile Card */}
        <Card variant="elevated" style={styles.cardSpacing}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <User size={28} color={colors.primary} />
            </View>
            <View style={styles.infoWrapper}>
              <Text style={styles.nameText}>{parent?.name || 'ولي الأمر'}</Text>
              <View style={styles.phoneRow}>
                <Phone size={14} color={colors.textMuted} />
                <Text style={styles.phoneText}>{parent?.phone || '—'}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Device & Security Settings */}
        <Card variant="elevated" style={styles.cardSpacing}>
          <View style={styles.sectionHeader}>
            <Smartphone size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>الجهاز والجلسة الحالية</Text>
          </View>
          <Text style={styles.descText}>
            هذا الجهاز مسجل لاستقبال إشعارات الحضور والغياب والدرجات فور صدورها.
          </Text>
        </Card>

        {/* App Info */}
        <Card variant="flat" style={styles.cardSpacing}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>منصة مُنظِّم</Text>
          </View>
          <Text style={styles.versionText}>الإصدار 1.0.0 (Parent Mobile App)</Text>
        </Card>

        {/* Logout */}
        <View style={styles.footer}>
          <Button
            title="تسجيل الخروج من هذا الجهاز"
            variant="danger"
            size="lg"
            onPress={handleLogout}
            icon={<LogOut size={20} color={colors.textInverse} />}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  title: {
    ...textStyles.h2,
    color: colors.text,
  },
  cardSpacing: {
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  infoWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nameText: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.text,
  },
  phoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  phoneText: {
    fontFamily: typography.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
  },
  descText: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
  versionText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  footer: {
    marginTop: spacing.lg,
  },
});
