import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Rect,
} from 'react-native-svg';
import { AuthStackParamList } from '../../navigation/types';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import {
  GraduationCap,
  QrCode,
  Phone,
  BellRing,
  Award,
  WalletCards,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

// ── Background Wave Decorator Component ─────────────────────────────────────────
const BlueWaveBackground: React.FC = () => {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg
        width={SCREEN_WIDTH}
        height={SCREEN_HEIGHT}
        viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}
        style={StyleSheet.absoluteFillObject}
      >
        <Defs>
          {/* Main Deep Ocean Gradient */}
          <SvgLinearGradient id="bgGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#081b33" />
            <Stop offset="35%" stopColor="#0b2c54" />
            <Stop offset="70%" stopColor="#0a2546" />
            <Stop offset="100%" stopColor="#061426" />
          </SvgLinearGradient>

          {/* Wave Gradient Layer 1 (Dark Royal) */}
          <SvgLinearGradient id="waveGrad1" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#0e3d73" stopOpacity="0.85" />
            <Stop offset="100%" stopColor="#082347" stopOpacity="0.9" />
          </SvgLinearGradient>

          {/* Wave Gradient Layer 2 (Vibrant Azure) */}
          <SvgLinearGradient id="waveGrad2" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
            <Stop offset="50%" stopColor="#026aa2" stopOpacity="0.55" />
            <Stop offset="100%" stopColor="#0b396e" stopOpacity="0.6" />
          </SvgLinearGradient>

          {/* Wave Gradient Layer 3 (Glowing Cyan Highlight) */}
          <SvgLinearGradient id="waveGrad3" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <Stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.2" />
            <Stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
          </SvgLinearGradient>

          {/* Glow Orb Gradient */}
          <SvgLinearGradient id="glowOrb" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <Stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>

        {/* Base Background */}
        <Rect x="0" y="0" width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#bgGradient)" />

        {/* Ambient Glowing Orbs */}
        <Circle cx={SCREEN_WIDTH * 0.85} cy={SCREEN_HEIGHT * 0.15} r={140} fill="url(#glowOrb)" />
        <Circle cx={SCREEN_WIDTH * 0.1} cy={SCREEN_HEIGHT * 0.55} r={120} fill="url(#glowOrb)" />
        <Circle cx={SCREEN_WIDTH * 0.9} cy={SCREEN_HEIGHT * 0.85} r={160} fill="url(#glowOrb)" />

        {/* Wave 1 - Deep Top Flow */}
        <Path
          d={`M 0 0 
             L 0 ${SCREEN_HEIGHT * 0.28} 
             Q ${SCREEN_WIDTH * 0.25} ${SCREEN_HEIGHT * 0.35}, ${SCREEN_WIDTH * 0.5} ${SCREEN_HEIGHT * 0.26} 
             T ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.32} 
             L ${SCREEN_WIDTH} 0 Z`}
          fill="url(#waveGrad1)"
        />

        {/* Wave 2 - Middle Flowing Azure Wave */}
        <Path
          d={`M 0 ${SCREEN_HEIGHT * 0.24} 
             C ${SCREEN_WIDTH * 0.3} ${SCREEN_HEIGHT * 0.18}, ${SCREEN_WIDTH * 0.65} ${SCREEN_HEIGHT * 0.36}, ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.27} 
             L ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.58} 
             C ${SCREEN_WIDTH * 0.7} ${SCREEN_HEIGHT * 0.64}, ${SCREEN_WIDTH * 0.3} ${SCREEN_HEIGHT * 0.48}, 0 ${SCREEN_HEIGHT * 0.54} Z`}
          fill="url(#waveGrad2)"
        />

        {/* Wave 3 - Cyan Accent Curved Ridge */}
        <Path
          d={`M 0 ${SCREEN_HEIGHT * 0.48} 
             C ${SCREEN_WIDTH * 0.35} ${SCREEN_HEIGHT * 0.42}, ${SCREEN_WIDTH * 0.7} ${SCREEN_HEIGHT * 0.56}, ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.50} 
             L ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.62} 
             C ${SCREEN_WIDTH * 0.65} ${SCREEN_HEIGHT * 0.68}, ${SCREEN_WIDTH * 0.25} ${SCREEN_HEIGHT * 0.58}, 0 ${SCREEN_HEIGHT * 0.66} Z`}
          fill="url(#waveGrad3)"
        />

        {/* Wave 4 - Bottom Deep Foundation Wave */}
        <Path
          d={`M 0 ${SCREEN_HEIGHT * 0.72} 
             C ${SCREEN_WIDTH * 0.3} ${SCREEN_HEIGHT * 0.68}, ${SCREEN_WIDTH * 0.75} ${SCREEN_HEIGHT * 0.78}, ${SCREEN_WIDTH} ${SCREEN_HEIGHT * 0.70} 
             L ${SCREEN_WIDTH} ${SCREEN_HEIGHT} 
             L 0 ${SCREEN_HEIGHT} Z`}
          fill="url(#waveGrad1)"
        />
      </Svg>
    </View>
  );
};

export const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#081b33" translucent />
      <BlueWaveBackground />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 20) + spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Brand & Hero Header ────────────────────────────────────────── */}
          <View style={styles.heroSection}>
            {/* Floating Glow Logo Badge */}
            <View style={styles.logoGlowContainer}>
              <View style={styles.logoOuterRing}>
                <View style={styles.logoInnerBadge}>
                  <GraduationCap size={40} color="#38bdf8" strokeWidth={2.2} />
                </View>
              </View>
            </View>

            {/* Smart Pill Tag */}
            <View style={styles.pillBadge}>
              <Sparkles size={14} color="#38bdf8" />
              <Text style={styles.pillText}>المنصة الذكية لمتابعة الأبناء</Text>
            </View>

            {/* App Title */}
            <Text style={styles.appTitle}>مُنظَّم</Text>

            {/* Catchy Rhymed Marketing Slogan */}
            <View style={styles.rhymeBox}>
              <Text style={styles.rhymeLine1}>مع مُنظَّم.. لمستقبلٍ أعظَم</Text>
              <Text style={styles.rhymeLine2}>
                اطمئن على ابنك من بيتك.. نجاحه وتفوقه بين إيديك
              </Text>
            </View>
          </View>

          {/* ── Glassmorphism Feature Cards ───────────────────────────────── */}
          <View style={styles.cardsContainer}>
            {/* Feature 1: Attendance */}
            <View style={styles.glassCard}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                <BellRing size={22} color="#38bdf8" />
              </View>
              <View style={styles.cardTextContent}>
                <Text style={styles.cardTitle}>حضور وغياب لحظي</Text>
                <Text style={styles.cardSubtitle}>
                  إشعار فوري وتنبيه مباشر لحظة دخول وخروج ابنك من الحصة
                </Text>
              </View>
            </View>

            {/* Feature 2: Exams & Results */}
            <View style={styles.glassCard}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                <Award size={22} color="#34d399" />
              </View>
              <View style={styles.cardTextContent}>
                <Text style={styles.cardTitle}>درجات وتقارير أولاً بأول</Text>
                <Text style={styles.cardSubtitle}>
                  رصد دقيق لنتائج الاختبارات ومستوى التطور خطوة بخطوة
                </Text>
              </View>
            </View>

            {/* Feature 3: Financial & Cycles */}
            <View style={styles.glassCard}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
                <WalletCards size={22} color="#fbbf24" />
              </View>
              <View style={styles.cardTextContent}>
                <Text style={styles.cardTitle}>متابعة الحصص والاشتراكات</Text>
                <Text style={styles.cardSubtitle}>
                  حسابات واضحة لعدد الحصص والمدفوعات بدون حيرة أو نسيان
                </Text>
              </View>
            </View>
          </View>

          {/* ── Call To Actions (Interactive Buttons) ────────────────────── */}
          <View style={styles.actionsSection}>
            {/* Primary Action Button: Barcode Scanner */}
            <TouchableOpacity
              activeOpacity={0.88}
              style={styles.primaryActionButton}
              onPress={() => navigation.navigate('BarcodeScanner')}
            >
              <View style={styles.btnInnerRow}>
                <View style={styles.btnIconWrapper}>
                  <QrCode size={22} color="#081b33" strokeWidth={2.4} />
                </View>
                <Text style={styles.primaryBtnText}>مسح كارت الطالب (دخول فوري)</Text>
                <ArrowLeft size={18} color="#081b33" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>

            {/* Secondary Action Button: Phone Number Entry */}
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.secondaryActionButton}
              onPress={() => navigation.navigate('PhoneEntry')}
            >
              <View style={styles.btnInnerRow}>
                <Phone size={18} color="#e0f2fe" />
                <Text style={styles.secondaryBtnText}>الدخول برقم الهاتف المسجل</Text>
              </View>
            </TouchableOpacity>

            {/* Trust Footer Guarantee */}
            <View style={styles.trustBadge}>
              <ShieldCheck size={15} color="#38bdf8" />
              <Text style={styles.trustText}>نظام مشفر وموثوق لمتابعة آمنة لولي الأمر</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#081b33',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    justifyContent: 'space-between',
  },

  // ── Hero Section ───────────────────────────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  logoGlowContainer: {
    marginBottom: spacing.sm,
  },
  logoOuterRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoInnerBadge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(11, 44, 84, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    gap: 6,
    marginBottom: spacing.xs,
  },
  pillText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: '#bae6fd',
  },
  appTitle: {
    fontFamily: typography.fontFamily.extraBold,
    fontSize: 34,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  rhymeBox: {
    marginTop: 6,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  rhymeLine1: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 19,
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 28,
  },
  rhymeLine2: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13.5,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Glassmorphism Feature Cards ────────────────────────────────────────────
  cardsContainer: {
    gap: 10,
    marginVertical: spacing.sm,
  },
  glassCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 41, 77, 0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardTextContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 14.5,
    color: '#f8fafc',
    textAlign: 'right',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    lineHeight: 18,
  },

  // ── Call to Actions ────────────────────────────────────────────────────────
  actionsSection: {
    marginTop: spacing.md,
    gap: 10,
  },
  primaryActionButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnInnerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnIconWrapper: {
    backgroundColor: 'rgba(8, 27, 51, 0.12)',
    padding: 3,
    borderRadius: 6,
  },
  primaryBtnText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: '#081b33',
    textAlign: 'center',
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  secondaryBtnText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 14.5,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  trustText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'center',
  },
});
