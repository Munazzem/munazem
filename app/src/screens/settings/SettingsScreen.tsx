import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, StatusBar, Linking, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/auth.store';
import { useChildStore } from '../../store/child.store';
import { AuthApi } from '../../api/auth.api';
import { useQuery } from '@tanstack/react-query';
import { HomeApi } from '../../api/home.api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import {
  User, Phone, Users, Bell, HelpCircle, Info,
  LogOut, ChevronLeft, Shield, Star, X, MessageSquare, CheckCircle2,
} from 'lucide-react-native';

const SUPPORT_PHONE = '01288494803';
const SUPPORT_WHATSAPP = '201288494803';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { parent, logout } = useAuthStore();
  const { selectedChild, selectedChildId, setSelectedChild } = useChildStore();
  const insets = useSafeAreaInsets();

  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  const handleCallSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
      Alert.alert('تنبيه', `يرجى الاتصال بالرقم: ${SUPPORT_PHONE}`);
    });
  };

  const handleWhatsAppSupport = () => {
    Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP}`).catch(() => {
      Alert.alert('تنبيه', `يرجى مراسلة الرقم عبر واتساب: ${SUPPORT_PHONE}`);
    });
  };

  const { data } = useQuery({
    queryKey: ['family-overview'],
    queryFn: HomeApi.getFamilyOverview,
    staleTime: 1000 * 60 * 5,
  });

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج؟', [
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

  const handleSwitchChild = () => {
    if (data?.children && data.children.length > 1) {
      navigation.navigate('SelectChild', { children: data.children, mode: 'switch' });
    }
  };

  const displayChild = data?.children?.find((c) => c.id === selectedChildId)
    ?? data?.children?.[0]
    ?? selectedChild;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) + 80 }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>الإعدادات</Text>
          </View>

          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {(parent?.name ?? 'و').charAt(0)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{parent?.name ?? 'ولي الأمر'}</Text>
              <View style={styles.profilePhoneRow}>
                <Phone size={13} color={colors.skyBlue} />
                <Text style={styles.profilePhone}>{parent?.phone ?? '—'}</Text>
              </View>
            </View>
          </View>

          {/* Current Student Indicator */}
          {displayChild && (
            <View style={styles.currentChild}>
              <View style={styles.currentChildInfo}>
                <Text style={styles.currentChildLabel}>الطالب الحالي</Text>
                <Text style={styles.currentChildName}>{displayChild.studentName}</Text>
                <Text style={styles.currentChildGrade}>{displayChild.gradeLevel}</Text>
              </View>
              <View style={[styles.activeDot]} />
            </View>
          )}

          {/* Section: أبنائي */}
          <SettingsSection title="أبنائي">
            {(data?.children ?? []).map((child) => (
              <SettingsRow
                key={child.id}
                icon={<User size={18} color={child.id === selectedChildId ? colors.skyBlue : colors.textSecondary} />}
                label={child.studentName}
                sublabel={child.gradeLevel}
                active={child.id === selectedChildId}
                onPress={async () => {
                  await setSelectedChild(child);
                }}
                isLast={child === (data?.children ?? [])[((data?.children ?? []).length - 1)]}
              />
            ))}
            {(data?.children?.length ?? 0) > 1 && (
              <TouchableOpacity style={styles.switchAllBtn} onPress={handleSwitchChild}>
                <Users size={15} color={colors.primary} />
                <Text style={styles.switchAllText}>عرض كل الطلاب والتبديل</Text>
              </TouchableOpacity>
            )}
          </SettingsSection>

          {/* Section: الإشعارات */}
          <SettingsSection title="الإشعارات">
            <SettingsToggle
              icon={<Bell size={18} color={colors.textSecondary} />}
              label="إشعارات الحضور"
              sublabel="تنبيه فوري لحظة الحضور والغياب"
              value={true}
              onToggle={() => {}}
            />
            <SettingsToggle
              icon={<Star size={18} color={colors.textSecondary} />}
              label="إشعارات الدرجات"
              sublabel="عند إضافة نتيجة اختبار جديدة"
              value={true}
              onToggle={() => {}}
              isLast
            />
          </SettingsSection>

          {/* Section: الدعم والمعلومات */}
          <SettingsSection title="الدعم والمعلومات">
            <SettingsRow
              icon={<HelpCircle size={18} color={colors.textSecondary} />}
              label="المساعدة والدعم"
              onPress={() => setSupportModalVisible(true)}
            />
            <SettingsRow
              icon={<Info size={18} color={colors.textSecondary} />}
              label="عن منظم"
              sublabel="الإصدار 1.0.0"
              onPress={() => setAboutModalVisible(true)}
            />
            <SettingsRow
              icon={<Shield size={18} color={colors.textSecondary} />}
              label="سياسة الخصوصية"
              onPress={() => setPrivacyModalVisible(true)}
              isLast
            />
          </SettingsSection>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={18} color={colors.absent} />
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      {/* ── Modal: المساعدة والدعم ── */}
      <Modal
        visible={supportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSupportModalVisible(false)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.card}>
                <View style={modalStyles.header}>
                  <TouchableOpacity onPress={() => setSupportModalVisible(false)} style={modalStyles.closeBtn}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={modalStyles.headerTitleWrap}>
                    <Text style={modalStyles.title}>المساعدة والدعم الفني</Text>
                    <View style={[modalStyles.iconBadge, { backgroundColor: '#e0f2fe' }]}>
                      <HelpCircle size={20} color={colors.primary} />
                    </View>
                  </View>
                </View>

                <Text style={modalStyles.desc}>
                  فريق الدعم الفني لمنصة منظّم متاح لمساعدتك في أي استفسار أو مشكلة تواجهك داخل التطبيق.
                </Text>

                <View style={modalStyles.phoneCard}>
                  <Text style={modalStyles.phoneLabel}>رقم الدعم الفني المباشر</Text>
                  <Text style={modalStyles.phoneNumber}>{SUPPORT_PHONE}</Text>
                  <Text style={modalStyles.phoneSub}>متاح عبر الواتساب والمكالمات المباشرة</Text>
                </View>

                <View style={modalStyles.actions}>
                  <TouchableOpacity
                    style={[modalStyles.actionBtn, modalStyles.whatsappBtn]}
                    onPress={handleWhatsAppSupport}
                    activeOpacity={0.8}
                  >
                    <MessageSquare size={18} color="#ffffff" />
                    <Text style={modalStyles.btnTextWhite}>محادثة عبر واتساب</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[modalStyles.actionBtn, modalStyles.callBtn]}
                    onPress={handleCallSupport}
                    activeOpacity={0.8}
                  >
                    <Phone size={18} color="#ffffff" />
                    <Text style={modalStyles.btnTextWhite}>اتصال هاتفي مباشر</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal: عن منظّم ── */}
      <Modal
        visible={aboutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAboutModalVisible(false)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.card}>
                <View style={modalStyles.header}>
                  <TouchableOpacity onPress={() => setAboutModalVisible(false)} style={modalStyles.closeBtn}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={modalStyles.headerTitleWrap}>
                    <Text style={modalStyles.title}>عن تطبيق منظّم</Text>
                    <View style={[modalStyles.iconBadge, { backgroundColor: '#f0f9ff' }]}>
                      <Info size={20} color={colors.royalBlue} />
                    </View>
                  </View>
                </View>

                <View style={modalStyles.aboutBadge}>
                  <Text style={modalStyles.aboutBadgeText}>الإصدار 1.0.0 (النسخة الرسمية)</Text>
                </View>

                <Text style={modalStyles.desc}>
                  منظّم هي المنصة التعليمية المتكاملة لإدارة السناتر والمجموعات ومتابعة الطلاب، صُممت لتوفير تجربة سهلة وشفافة لولي الأمر.
                </Text>

                <View style={modalStyles.featuresList}>
                  <View style={modalStyles.featureItem}>
                    <Text style={modalStyles.featureText}>تسجيل ومتابعة الحضور والغياب مع تنبيهات فورية</Text>
                    <CheckCircle2 size={16} color={colors.present} />
                  </View>
                  <View style={modalStyles.featureItem}>
                    <Text style={modalStyles.featureText}>عرض نتائج ودرجات الاختبارات وتقييمات المعلمين</Text>
                    <CheckCircle2 size={16} color={colors.present} />
                  </View>
                  <View style={modalStyles.featureItem}>
                    <Text style={modalStyles.featureText}>متابعة الباقات والاشتراكات ومواعيد الحصص</Text>
                    <CheckCircle2 size={16} color={colors.present} />
                  </View>
                </View>

                <View style={modalStyles.footerNote}>
                  <Text style={modalStyles.footerNoteText}>للدعم الفني والاستفسارات: {SUPPORT_PHONE}</Text>
                  <Text style={modalStyles.copyrightText}>جميع الحقوق محفوظة لمنظّم © 2026</Text>
                </View>

                <TouchableOpacity
                  style={[modalStyles.actionBtn, modalStyles.primaryOutlineBtn]}
                  onPress={() => setAboutModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={modalStyles.primaryOutlineBtnText}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Modal: سياسة الخصوصية ── */}
      <Modal
        visible={privacyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPrivacyModalVisible(false)}>
          <View style={modalStyles.overlay}>
            <TouchableWithoutFeedback>
              <View style={modalStyles.card}>
                <View style={modalStyles.header}>
                  <TouchableOpacity onPress={() => setPrivacyModalVisible(false)} style={modalStyles.closeBtn}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={modalStyles.headerTitleWrap}>
                    <Text style={modalStyles.title}>سياسة الخصوصية</Text>
                    <View style={[modalStyles.iconBadge, { backgroundColor: '#f0fdf4' }]}>
                      <Shield size={20} color={colors.present} />
                    </View>
                  </View>
                </View>

                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                  <View style={modalStyles.privacySection}>
                    <Text style={modalStyles.privacyHeading}>🔒 سرية وأمان البيانات</Text>
                    <Text style={modalStyles.privacyText}>
                      نلتزم في منصة "منظّم" بأعلى معايير الحماية والتشفير لحفظ سرية بيانات أولياء الأمور والطلاب.
                    </Text>
                  </View>

                  <View style={modalStyles.privacySection}>
                    <Text style={modalStyles.privacyHeading}>📱 الاستخدام المصرح به</Text>
                    <Text style={modalStyles.privacyText}>
                      تُستخدم أرقام الهواتف والبيانات المدخلة فقط لتسجيل الدخول الآمن، تسجيل الحضور والغياب، إرسال نتائج الدرجات، والتواصل التعليمي مع السنتر.
                    </Text>
                  </View>

                  <View style={modalStyles.privacySection}>
                    <Text style={modalStyles.privacyHeading}>🚫 عدم مشاركة البيانات</Text>
                    <Text style={modalStyles.privacyText}>
                      لا يتم بيع أو مشاركة أي بيانات شخصية مع أي جهات خارجية أو استخدامها في أي حملات إعلانية.
                    </Text>
                  </View>

                  <View style={modalStyles.privacySection}>
                    <Text style={modalStyles.privacyHeading}>📞 الاستفسار والدعم</Text>
                    <Text style={modalStyles.privacyText}>
                      لأي أسئلة حول سياسة الخصوصية، يرجى التواصل مع فريق الدعم على: {SUPPORT_PHONE}
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[modalStyles.actionBtn, modalStyles.primarySolidBtn, { marginTop: spacing.md }]}
                  onPress={() => setPrivacyModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={modalStyles.btnTextWhite}>حسناً، فهمت</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

// Sub-components
const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={secStyles.container}>
    <Text style={secStyles.title}>{title}</Text>
    <View style={secStyles.card}>{children}</View>
  </View>
);

const SettingsRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  active?: boolean;
  isLast?: boolean;
}> = ({ icon, label, sublabel, onPress, active, isLast }) => (
  <TouchableOpacity
    style={[secStyles.row, !isLast && secStyles.rowBorder]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <ChevronLeft size={18} color={colors.textMuted} />
    <View style={secStyles.rowInfo}>
      <Text style={[secStyles.rowLabel, active && { color: colors.primary }]}>{label}</Text>
      {sublabel && <Text style={secStyles.rowSub}>{sublabel}</Text>}
    </View>
    <View style={[secStyles.iconWrap, active && { backgroundColor: colors.primaryLight }]}>
      {icon}
    </View>
    {active && <View style={secStyles.activeDot} />}
  </TouchableOpacity>
);

const SettingsToggle: React.FC<{
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isLast?: boolean;
}> = ({ icon, label, sublabel, value, onToggle, isLast }) => (
  <View style={[secStyles.row, !isLast && secStyles.rowBorder]}>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
      thumbColor={value ? colors.primary : colors.textMuted}
    />
    <View style={secStyles.rowInfo}>
      <Text style={secStyles.rowLabel}>{label}</Text>
      {sublabel && <Text style={secStyles.rowSub}>{sublabel}</Text>}
    </View>
    <View style={secStyles.iconWrap}>{icon}</View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, backgroundColor: colors.navy },
  scroll: { backgroundColor: colors.background },
  header: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    alignItems: 'flex-end',
  },
  headerTitle: { fontFamily: typography.extraBold, fontSize: 26, color: colors.textInverse },
  profileCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.navyMid,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.skyBlue,
  },
  profileAvatarText: { fontFamily: typography.extraBold, fontSize: 24, color: colors.skyBlue },
  profileInfo: { flex: 1, alignItems: 'flex-end' },
  profileName: { fontFamily: typography.bold, fontSize: 18, color: colors.text },
  profilePhoneRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 4 },
  profilePhone: { fontFamily: typography.medium, fontSize: 13, color: colors.textSecondary },
  currentChild: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(15,76,129,0.15)',
  },
  currentChildInfo: { alignItems: 'flex-end' },
  currentChildLabel: { fontFamily: typography.medium, fontSize: 10, color: colors.primary, letterSpacing: 0.3 },
  currentChildName: { fontFamily: typography.bold, fontSize: 14, color: colors.primaryDark },
  currentChildGrade: { fontFamily: typography.regular, fontSize: 11, color: colors.primary, marginTop: 1 },
  activeDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.present,
    shadowColor: colors.present, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3,
  },
  switchAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  switchAllText: { fontFamily: typography.bold, fontSize: 13, color: colors.primary },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.absentLight,
    backgroundColor: '#fff5f5',
  },
  logoutText: { fontFamily: typography.bold, fontSize: 15, color: colors.absent },
});

const secStyles = StyleSheet.create({
  container: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  title: {
    fontFamily: typography.bold, fontSize: 13, color: colors.textMuted,
    textAlign: 'right', marginBottom: spacing.xs, letterSpacing: 0.3,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1, alignItems: 'flex-end' },
  rowLabel: { fontFamily: typography.bold, fontSize: 14, color: colors.text },
  rowSub: { fontFamily: typography.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  activeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.present,
    position: 'absolute', top: spacing.sm, left: spacing.sm,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,58,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: colors.text,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  phoneCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  phoneLabel: {
    fontFamily: typography.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  phoneNumber: {
    fontFamily: typography.extraBold,
    fontSize: 22,
    color: colors.primary,
    letterSpacing: 1,
  },
  phoneSub: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    gap: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  callBtn: {
    backgroundColor: colors.primary,
  },
  btnTextWhite: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#ffffff',
  },
  aboutBadge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.skyBlueFaint,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  aboutBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.royalBlue,
  },
  featuresList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  featureText: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    flex: 1,
  },
  footerNote: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  footerNoteText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  copyrightText: {
    fontFamily: typography.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  primaryOutlineBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  primaryOutlineBtnText: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: colors.primary,
  },
  primarySolidBtn: {
    backgroundColor: colors.primary,
  },
  privacySection: {
    marginBottom: spacing.md,
  },
  privacyHeading: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    marginBottom: 2,
  },
  privacyText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },
});
