import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { GraduationCap, ShieldCheck, BellRing, Sparkles, QrCode, Phone } from 'lucide-react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { paddingBottom: Math.max(insets.bottom, 24) + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.logoCircle}>
            <GraduationCap size={44} color={colors.primary} />
          </View>
          <Text style={styles.title}>مُنظِّم</Text>
          <Text style={styles.subtitle}>تطبيق ولي الأمر لمتابعة الدروس</Text>
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <BellRing size={20} color={colors.primary} />
            </View>
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>تنبيهات الحضور والغياب</Text>
              <Text style={styles.featureDesc}>إشعار فوري لحظة تسجيل حضور أو غياب ابنك</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Sparkles size={20} color={colors.primary} />
            </View>
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>الدرجات والنتائج أولاً بأول</Text>
              <Text style={styles.featureDesc}>متابعة تفصيلية لجميع الامتحانات وتطور المستوى</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <ShieldCheck size={20} color={colors.primary} />
            </View>
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>متابعة مالية دقيقة</Text>
              <Text style={styles.featureDesc}>معرفة عدد الحصص والمدفوعات والمتبقي بوضوح</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionContainer}>
          <Button
            title="مسح كارت الطالب (دخول فوري)"
            onPress={() => navigation.navigate('BarcodeScanner')}
            size="lg"
            variant="primary"
            icon={<QrCode size={20} color={colors.textInverse} />}
            style={styles.primaryBtn}
          />
          <Button
            title="الدخول برقم الهاتف المسجل"
            onPress={() => navigation.navigate('PhoneEntry')}
            size="md"
            variant="outline"
            icon={<Phone size={18} color={colors.primary} />}
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
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    justifyContent: 'space-between',
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    ...textStyles.display,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...textStyles.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  featuresContainer: {
    marginVertical: spacing.md,
  },
  featureItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  featureTextWrapper: {
    flex: 1,
    alignItems: 'flex-end',
  },
  featureTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
  },
  featureDesc: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  actionContainer: {
    marginTop: spacing.sm,
  },
  primaryBtn: {
    marginBottom: spacing.sm,
  },
});
