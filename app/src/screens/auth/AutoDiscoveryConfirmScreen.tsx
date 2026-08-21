import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { AuthApi } from '../../api/auth.api';
import { useAuthStore } from '../../store/auth.store';
import { Users, CheckCircle2, Sparkles } from 'lucide-react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'AutoDiscoveryConfirm'>;

export const AutoDiscoveryConfirmScreen: React.FC<Props> = ({ route }) => {
  const { discoveredStudents } = route.params;
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const clearDiscovered = useAuthStore((state) => state.clearDiscoveredStudents);

  const handleConfirmAll = async () => {
    setLoading(true);
    try {
      const studentIds = discoveredStudents.map((s) => s.studentId);
      await AuthApi.confirmDiscovered(studentIds);
    } catch (e) {
      console.warn('[AutoDiscovery] Confirmation failed (non-blocking):', e);
    } finally {
      setLoading(false);
      clearDiscovered();
    }
  };

  const handleSkip = () => {
    clearDiscovered();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) + spacing.md }]}>
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Users size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>وجدنا أبناءً آخرين لك!</Text>
          <Text style={styles.subtitle}>
            الطلاب التاليون مسجلون لدى معلمين آخرين بنفس رقم هاتفك. هل تود متابعتهم أيضاً؟
          </Text>
        </View>

        <FlatList
          data={discoveredStudents}
          keyExtractor={(item) => item.studentId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card variant="elevated" style={styles.studentCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.studentName}>{item.studentName}</Text>
                <CheckCircle2 size={20} color={colors.success} />
              </View>
              <Text style={styles.subjectText}>
                {item.subject} • المعلم: {item.teacherName}
              </Text>
              <Text style={styles.groupText}>
                {item.gradeLevel} ({item.groupName})
              </Text>
            </Card>
          )}
        />

        <View style={styles.footer}>
          <Button
            title="نعم، متابعة جميع الأبناء"
            onPress={handleConfirmAll}
            loading={loading}
            size="lg"
            variant="primary"
            icon={<Sparkles size={20} color={colors.textInverse} />}
            style={styles.confirmButton}
          />
          <Button
            title="تخطي والبدء الآن"
            onPress={handleSkip}
            variant="ghost"
            disabled={loading}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...textStyles.h2,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  studentCard: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  studentName: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
    textAlign: 'right',
  },
  subjectText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.primary,
    textAlign: 'right',
  },
  groupText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.md,
  },
  confirmButton: {
    marginBottom: spacing.xs,
  },
});
