import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle, Rect } from 'react-native-svg';
import { AuthStackParamList } from '../../navigation/types';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { GraduationCap, ArrowLeft, ShieldCheck } from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const Background: React.FC = () => (
  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgGrad id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#081529" />
          <Stop offset="50%" stopColor="#0b1f3a" />
          <Stop offset="100%" stopColor="#061020" />
        </SvgGrad>
        <SvgGrad id="orb" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.18" />
          <Stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </SvgGrad>
        <SvgGrad id="wave" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0e3d73" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#082347" stopOpacity="0.5" />
        </SvgGrad>
      </Defs>
      <Rect width={W} height={H} fill="url(#bg)" />
      <Circle cx={W * 0.85} cy={H * 0.18} r={160} fill="url(#orb)" />
      <Circle cx={W * 0.08} cy={H * 0.6} r={120} fill="url(#orb)" />
      <Path
        d={`M 0 ${H * 0.72} C ${W * 0.3} ${H * 0.66}, ${W * 0.7} ${H * 0.78}, ${W} ${H * 0.7} L ${W} ${H} L 0 ${H} Z`}
        fill="url(#wave)"
      />
    </Svg>
  </View>
);

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => (
  <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor="#081529" />
    <Background />
    <SafeAreaView style={s.safe}>
      <View style={s.body}>

        {/* Logo */}
        <View style={s.logoWrap}>
          <View style={s.logoRing}>
            <View style={s.logoBadge}>
              <GraduationCap size={36} color="#38bdf8" strokeWidth={2.2} />
            </View>
          </View>
        </View>

        {/* Brand */}
        <Text style={s.appName}>مُنظَّم</Text>
        <Text style={s.tagline}>كل تفاصيل ابنك في مكان واحد</Text>
        <Text style={s.desc}>
          تابع الحضور، الدرجات، والمدفوعات بكل سهولة
          {'\n'}من مكانك وفي أي وقت
        </Text>

        {/* Features */}
        <View style={s.features}>
          {[
            { emoji: '📅', text: 'حضور وغياب لحظي' },
            { emoji: '📊', text: 'درجات وتقارير فورية' },
            { emoji: '💰', text: 'متابعة الاشتراكات بوضوح' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureEmoji}>{f.emoji}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('LoginChoice')}
        >
          <ArrowLeft size={20} color="#081529" strokeWidth={2.5} />
          <Text style={s.btnText}>التالي</Text>
        </TouchableOpacity>

        <View style={s.trust}>
          <ShieldCheck size={13} color="#38bdf8" />
          <Text style={s.trustText}>نظام مشفر وآمن لولي الأمر</Text>
        </View>
      </View>
    </SafeAreaView>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#081529' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Logo
  logoWrap: { marginBottom: spacing.xl },
  logoRing: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(56,189,248,0.35)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#38bdf8', shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  logoBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(11,44,84,0.95)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  // Brand
  appName: {
    fontFamily: typography.extraBold,
    fontSize: 38, color: '#ffffff',
    textAlign: 'center', letterSpacing: 0.5,
    textShadowColor: 'rgba(56,189,248,0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
    marginBottom: spacing.sm,
  },
  tagline: {
    fontFamily: typography.bold,
    fontSize: 18, color: '#38bdf8',
    textAlign: 'center', marginBottom: spacing.sm,
  },
  desc: {
    fontFamily: typography.regular,
    fontSize: 14, color: '#94a3b8',
    textAlign: 'center', lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  // Features
  features: { gap: spacing.sm, alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  featureRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(15,41,77,0.6)',
    borderRadius: 14, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(56,189,248,0.15)',
  },
  featureEmoji: { fontSize: 20 },
  featureText: {
    fontFamily: typography.medium,
    fontSize: 14, color: '#e2e8f0',
    flex: 1, textAlign: 'right',
  },
  // CTA
  footer: { paddingBottom: spacing.xl, gap: spacing.sm },
  btn: {
    backgroundColor: '#38bdf8',
    borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#38bdf8', shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  btnText: {
    fontFamily: typography.bold,
    fontSize: 18, color: '#081529',
  },
  trust: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
  },
  trustText: {
    fontFamily: typography.regular,
    fontSize: 12, color: '#475569',
  },
});
