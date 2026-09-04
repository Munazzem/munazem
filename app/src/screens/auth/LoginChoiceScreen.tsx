import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { colors } from '../../theme/colors';
import { Phone, QrCode, ChevronRight } from 'lucide-react-native';

type Props = NativeStackScreenProps<AuthStackParamList, 'LoginChoice'>;

export const LoginChoiceScreen: React.FC<Props> = ({ navigation }) => (
  <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>تسجيل الدخول</Text>
        <Text style={s.subtitle}>اختر طريقة الدخول لمتابعة أبنائك</Text>
      </View>

      {/* Options */}
      <View style={s.options}>

        {/* QR Scan */}
        <TouchableOpacity
          style={s.optionCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('BarcodeScanner')}
        >
          <View style={[s.iconBox, { backgroundColor: 'rgba(56,189,248,0.12)', borderColor: 'rgba(56,189,248,0.3)' }]}>
            <QrCode size={32} color="#38bdf8" strokeWidth={2} />
          </View>
          <View style={s.optionInfo}>
            <Text style={s.optionTitle}>مسح كارت الطالب</Text>
            <Text style={s.optionDesc}>دخول فوري بمسح الباركود أو الـ QR Code</Text>
          </View>
          <ChevronRight size={20} color={colors.navyLight} style={{ transform: [{ scaleX: -1 }] }} />
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>أو</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Phone */}
        <TouchableOpacity
          style={[s.optionCard, s.optionCardLight]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('PhoneEntry')}
        >
          <View style={[s.iconBox, { backgroundColor: 'rgba(15,76,129,0.1)', borderColor: 'rgba(15,76,129,0.25)' }]}>
            <Phone size={28} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={s.optionInfo}>
            <Text style={[s.optionTitle, { color: colors.text }]}>رقم الهاتف المسجل</Text>
            <Text style={s.optionDescLight}>أدخل رقم الهاتف المربوط بحساب ولي الأمر</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} style={{ transform: [{ scaleX: -1 }] }} />
        </TouchableOpacity>
      </View>

      {/* Back */}
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Text style={s.backText}>رجوع</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  header: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: typography.extraBold,
    fontSize: 30, color: '#ffffff',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.regular,
    fontSize: 15, color: '#94a3b8',
    textAlign: 'right',
  },
  options: { gap: spacing.md },
  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(15,41,77,0.7)',
    borderRadius: 20,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(56,189,248,0.2)',
  },
  optionCardLight: {
    backgroundColor: '#ffffff',
    borderColor: colors.borderLight,
  },
  iconBox: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  optionInfo: { flex: 1, alignItems: 'flex-end' },
  optionTitle: {
    fontFamily: typography.bold,
    fontSize: 17, color: '#f8fafc',
    marginBottom: 4,
  },
  optionDesc: {
    fontFamily: typography.regular,
    fontSize: 13, color: '#94a3b8',
    textAlign: 'right', lineHeight: 18,
  },
  optionDescLight: {
    fontFamily: typography.regular,
    fontSize: 13, color: colors.textSecondary,
    textAlign: 'right', lineHeight: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: {
    fontFamily: typography.medium,
    fontSize: 13, color: '#475569',
  },
  backBtn: {
    marginTop: 'auto' as any,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  backText: {
    fontFamily: typography.medium,
    fontSize: 14, color: '#475569',
  },
});
