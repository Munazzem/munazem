import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { InquiriesApi } from '../../api/inquiries.api';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { confirmAction, showAlert } from '../../utils/alert.util';
import {
  INQUIRY_CATEGORY_LABELS,
  MAX_INQUIRY_EDITS,
} from '../../types/inquiry.types';
import {
  formatArabicDateTime,
  getStatusVisualConfig,
} from './InquiriesScreen';
import {
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Edit3,
  Trash2,
  User,
  Users,
  Plus,
  AlertCircle,
} from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'InquiryDetail'>;

export const InquiryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { inquiryId } = route.params;
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();

  const {
    data: inquiry,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['parent-inquiry-detail', inquiryId],
    queryFn: () => InquiriesApi.getInquiryById(inquiryId),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (!isFocused) return false;
      return query.state.data?.isOpen ? 30_000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => InquiriesApi.cancelInquiry(inquiryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
      queryClient.invalidateQueries({
        queryKey: ['parent-inquiry-detail', inquiryId],
      });
      showAlert('تم الإلغاء', 'تم إلغاء الطلب بنجاح. يمكنك الآن إرسال طلب جديد.');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'تعذر إلغاء الطلب، قد يكون تم الرد عليه أو تحويله للمستر.';
      queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
      queryClient.invalidateQueries({
        queryKey: ['parent-inquiry-detail', inquiryId],
      });
      showAlert('تعذر الإلغاء', msg);
    },
  });

  const handleConfirmCancel = () => {
    confirmAction({
      title: 'إلغاء الطلب',
      message:
        'هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ بعد الإلغاء يمكنك إرسال استفسار جديد.',
      confirmText: 'نعم، إلغاء الطلب',
      cancelText: 'تراجع',
      isDestructive: true,
      onConfirm: () => {
        cancelMutation.mutate();
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>جاري تحميل تفاصيل الطلب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !inquiry) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerBox}>
          <AlertCircle size={40} color={colors.danger} />
          <Text style={styles.errorTitle}>تعذر تحميل تفاصيل الطلب</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => refetch()}
          >
            <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusCfg = getStatusVisualConfig(inquiry.status);
  const categoryLabel =
    INQUIRY_CATEGORY_LABELS[inquiry.category] || inquiry.category;
  const remainingEdits = Math.max(0, MAX_INQUIRY_EDITS - inquiry.editCount);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.skyBlue}
          />
        }
      >
        {/* ── Main Inquiry Card ── */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>

            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
            </View>
          </View>

          {/* Student & Group Meta */}
          <View style={styles.metaBox}>
            {inquiry.studentName ? (
              <View style={styles.metaRow}>
                <User size={13} color={colors.primary} />
                <Text style={styles.metaText}>
                  الطالب: <Text style={styles.metaBold}>{inquiry.studentName}</Text>
                </Text>
              </View>
            ) : null}

            {inquiry.groupName ? (
              <View style={styles.metaRow}>
                <Users size={13} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  المجموعة: <Text style={styles.metaBold}>{inquiry.groupName}</Text>
                </Text>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <Clock size={13} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                تاريخ الإرسال: {formatArabicDateTime(inquiry.createdAt)}
              </Text>
            </View>

            {inquiry.editCount > 0 && (
              <View style={styles.metaRow}>
                <Edit3 size={13} color={colors.warningDark} />
                <Text style={styles.metaText}>
                  تم التعديل {inquiry.editCount} من {MAX_INQUIRY_EDITS} مرات
                  {inquiry.editedAt
                    ? ` (آخر تعديل: ${formatArabicDateTime(inquiry.editedAt)})`
                    : ''}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>نص رسالتك:</Text>
          <View style={styles.bodyBox}>
            <Text style={styles.bodyText}>{inquiry.body}</Text>
          </View>

          {/* ── PENDING Actions (Edit / Cancel) ── */}
          {inquiry.status === 'PENDING' && (
            <View style={styles.pendingActionsWrap}>
              <Text style={styles.editsRemainingHint}>
                {remainingEdits > 0
                  ? `يمكنك تعديل نص الرسالة (${remainingEdits} تعديلات متبقية) أو إلغاء الطلب طالما لم يتم الرد بعد.`
                  : 'لقد استنفدت الحد الأقصى للتعديل (3 مرات). لا يزال بإمكانك إلغاء الطلب.'}
              </Text>

              <View style={styles.actionsRow}>
                {remainingEdits > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() =>
                      navigation.navigate('InquiryCompose', {
                        mode: 'edit',
                        inquiryId: inquiry._id,
                        initialBody: inquiry.body,
                        initialCategory: inquiry.category,
                        editCount: inquiry.editCount,
                      })
                    }
                    style={styles.editBtn}
                  >
                    <Edit3 size={15} color="#ffffff" />
                    <Text style={styles.editBtnText}>تعديل الرسالة</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={cancelMutation.isPending}
                  onPress={handleConfirmCancel}
                  style={styles.cancelBtn}
                >
                  <Trash2 size={15} color={colors.danger} />
                  <Text style={styles.cancelBtnText}>
                    {cancelMutation.isPending ? 'جاري الإلغاء...' : 'إلغاء الطلب'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── ESCALATED Status Card ── */}
        {inquiry.status === 'ESCALATED' && (
          <View style={styles.escalatedCard}>
            <View style={styles.escalatedHeader}>
              <ArrowUpRight size={18} color="#6b21a8" />
              <Text style={styles.escalatedTitle}>
                طلبك محوّل للمستر وقيد المراجعة
              </Text>
            </View>
            <Text style={styles.escalatedDesc}>
              قام الأسيستنت بتحويل استفسارك للمستر للرد عليك بنفسه. سيصلك إشعار
              فوري فور إرسال الرد، ولا يمكن تعديل أو إلغاء الطلب أثناء المراجعة.
            </Text>
          </View>
        )}

        {/* ── REPLIED Card ── */}
        {inquiry.status === 'REPLIED' && inquiry.reply && (
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <View style={styles.replierBadge}>
                <CheckCircle2 size={14} color={colors.successDark} />
                <Text style={styles.replierBadgeText}>
                  {inquiry.reply.repliedByRole === 'teacher'
                    ? 'رد المستر'
                    : 'رد الأسيستنت'}
                </Text>
              </View>

              <Text style={styles.replierName}>
                {inquiry.reply.repliedByName}
              </Text>
            </View>

            <View style={styles.replyBodyBox}>
              <Text style={styles.replyBodyText}>{inquiry.reply.body}</Text>
            </View>

            <Text style={styles.replyTimeText}>
              تاريخ الرد: {formatArabicDateTime(inquiry.reply.repliedAt)}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('InquiryCompose', {
                  mode: 'create',
                  studentId: inquiry.studentId,
                  studentName: inquiry.studentName,
                })
              }
              style={styles.newAfterReplyBtn}
            >
              <Plus size={16} color={colors.navy} />
              <Text style={styles.newAfterReplyBtnText}>
                إرسال استفسار جديد
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CANCELLED Card ── */}
        {inquiry.status === 'CANCELLED' && (
          <View style={styles.cancelledCard}>
            <View style={styles.cancelledHeader}>
              <XCircle size={18} color="#475569" />
              <Text style={styles.cancelledTitle}>تم إلغاء هذا الطلب</Text>
            </View>
            {inquiry.cancelledAt && (
              <Text style={styles.cancelledTime}>
                بتاريخ: {formatArabicDateTime(inquiry.cancelledAt)}
              </Text>
            )}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() =>
                navigation.navigate('InquiryCompose', {
                  mode: 'create',
                  studentId: inquiry.studentId,
                  studentName: inquiry.studentName,
                })
              }
              style={styles.newAfterReplyBtn}
            >
              <Plus size={16} color={colors.navy} />
              <Text style={styles.newAfterReplyBtnText}>
                إرسال استفسار جديد
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: spacing.sm,
  },
  errorTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#ffffff',
    marginTop: spacing.md,
  },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.navy,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  statusBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  categoryBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  metaBox: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: 5,
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  metaBold: {
    fontFamily: typography.bold,
    color: colors.text,
  },
  sectionLabel: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.navy,
    textAlign: 'right',
    marginBottom: 6,
  },
  bodyBox: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bodyText: {
    fontFamily: typography.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
  },
  pendingActionsWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editsRemainingHint: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  editBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: '#ffffff',
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerLight,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  cancelBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.danger,
  },
  escalatedCard: {
    backgroundColor: '#f3e8ff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#d8b4fe',
    marginBottom: spacing.md,
  },
  escalatedHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  escalatedTitle: {
    fontFamily: typography.extraBold,
    fontSize: 15,
    color: '#6b21a8',
    textAlign: 'right',
  },
  escalatedDesc: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#581c87',
    textAlign: 'right',
    lineHeight: 20,
  },
  replyCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: '#86efac',
    marginBottom: spacing.md,
  },
  replyHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  replierBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  replierBadgeText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.successDark,
  },
  replierName: {
    fontFamily: typography.extraBold,
    fontSize: 14,
    color: colors.navy,
  },
  replyBodyBox: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
  },
  replyBodyText: {
    fontFamily: typography.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 22,
  },
  replyTimeText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.successDark,
    textAlign: 'right',
  },
  newAfterReplyBtn: {
    marginTop: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.skyBlue,
    paddingVertical: 11,
    borderRadius: borderRadius.md,
  },
  newAfterReplyBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.navy,
  },
  cancelledCard: {
    backgroundColor: '#e2e8f0',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cancelledHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  cancelledTitle: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: '#334155',
  },
  cancelledTime: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    marginTop: 4,
  },
});
