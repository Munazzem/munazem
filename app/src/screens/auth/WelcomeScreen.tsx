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
import {
  GraduationCap,
  ArrowLeft,
  ShieldCheck,
  CalendarCheck,
  TrendingUp,
  WalletCards,
  Sparkles,
} from 'lucide-react-native';

const { width: W, height: H } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const Background: React.FC = () => (
  <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <SvgGrad id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#081529" />
          <Stop offset="45%" stopColor="#0b1f3a" />
          <Stop offset="100%" stopColor="#061020" />
        </SvgGrad>
        <SvgGrad id="orb" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
          <Stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </SvgGrad>
        <SvgGrad id="wave" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0e3d73" stopOpacity="0.75" />
          <Stop offset="100%" stopColor="#082347" stopOpacity="0.55" />
        </SvgGrad>
      </Defs>
      <Rect width={W} height={H} fill="url(#bg)" />
      <Circle cx={W * 0.85} cy={H * 0.16} r={170} fill="url(#orb)" />
      <Circle cx={W * 0.1} cy={H * 0.58} r={130} fill="url(#orb)" />
      <Path
        d={`M 0 ${H * 0.72} C ${W * 0.3} ${H * 0.66}, ${W * 0.7} ${H * 0.78}, ${W} ${H * 0.7} L ${W} ${H} L 0 ${H} Z`}
        fill="url(#wave)"
      />
    </Svg>
  </View>
);

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'حضور وغياب لحظي',
    desc: 'متابعة دقيقة لكل حصة فور تسجيلها بالسنتر',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.14)',
    border: 'rgba(56,189,248,0.28)',
  },
  {
    icon: TrendingUp,
    title: 'درجات وتقارير دورية',
    desc: 'نتائج الاختبارات والكويزات ومستوى التحصيل أولاً بأول',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.14)',
    border: 'rgba(52,211,153,0.28)',
  },
  {
    icon: WalletCards,
    title: 'متابعة الاشتراكات بوضوح',
    desc: 'تفاصيل الدورات والمدفوعات والمتبقي بدقة متناهية',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    border: 'rgba(251,191,36,0.28)',
  },
];

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => (
  <View style={s.root}>
    <StatusBar barStyle="light-content" backgroundColor="#081529" />
    <Background />
    <SafeAreaView style={s.safe}>
      <View style={s.body}>

        {/* Logo with elegant double glowing ring */}
        <View style={s.logoWrap}>
          <View style={s.logoOuterRing}>
            <View style={s.logoRing}>
              <View style={s.logoBadge}>
                <GraduationCap size={40} color="#38bdf8" strokeWidth={2.2} />
              </View>
            </View>
          </View>
        </View>

        {/* Brand */}
        <View style={s.brandBadge}>
          <Sparkles size={13} color="#38bdf8" />
          <Text style={s.brandBadgeText}>تطبيق ولي الأمر الموحد</Text>
        </View>

        <Text style={s.appName}>مُنظَّم</Text>
        <Text style={s.tagline}>كل تفاصيل ابنك التعليمية في مكان واحد</Text>
        <Text style={s.desc}>
          منظومة متكاملة لمتابعة مسيرة ابنك الدراسية مع السنتر بكل دقة ويسر
        </Text>

        {/* Features without any emojis - sleek vector badges */}
        <View style={s.features}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <View key={i} style={s.featureRow}>
                <View style={[s.featureIconBox, { backgroundColor: f.bg, borderColor: f.border }]}>
                  <Icon size={20} color={f.color} strokeWidth={2.2} />
                </View>
                <View style={s.featureTextCol}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* CTA Footer */}
      <View style={s.footer}>
        <TouchableOpacity
          style={s.btn}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('LoginChoice')}
        >
          <ArrowLeft size={20} color="#081529" strokeWidth={2.6} />
          <Text style={s.btnText}>ابدأ الآن</Text>
        </TouchableOpacity>

        <View style={s.trust}>
          <ShieldCheck size={14} color="#38bdf8" />
          <Text style={s.trustText}>نظام مشفر وآمن مخصص لأولياء الأمور</Text>
        </View>
      </View>
    </SafeAreaView>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#081529' },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.md },

  // Logo
  logoWrap: { marginBottom: spacing.md },
  logoOuterRing: {
    padding: 6,
    borderRadius: 60,
    backgroundColor: 'rgba(56,189,248,0.06)',
  },
  logoRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(56,189,248,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(56,189,248,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 8,
  },
  logoBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#0a2342',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },

  // Brand Badge
  brandBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.22)',
    marginBottom: spacing.xs,
  },
  brandBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#38bdf8',
  },

  // Brand Titles
  appName: {
    fontFamily: typography.extraBold,
    fontSize: 40,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(56,189,248,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
    marginBottom: 4,
  },
  tagline: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: 4,
  },
  desc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },

  // Features List
  features: {
    gap: spacing.sm,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(15,41,77,0.72)',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.16)',
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  featureTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 2,
    textAlign: 'right',
  },
  featureDesc: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
    lineHeight: 16,
  },

  // CTA Footer
  footer: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  btn: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: '#38bdf8',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  btnText: {
    fontFamily: typography.bold,
    fontSize: 17,
    color: '#081529',
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 2,
  },
  trustText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
  },
});

