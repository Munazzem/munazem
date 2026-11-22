import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { InquiriesApi } from '../../api/inquiries.api';
import { HomeApi } from '../../api/home.api';
import { useChildStore } from '../../store/child.store';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  MAX_INQUIRY_EDITS,
  ParentInquiry,
  InquiryStatus,
} from '../../types/inquiry.types';
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  AlertCircle,
  User,
  Info,
  ChevronLeft,
} from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Inquiries'>;

export interface TeacherEnrollmentOption {
  studentId: string;
  studentName: string;
  teacherName: string;
  subject: string;
  groupName: string;
  gradeLevel: string;
}

export function getStatusVisualConfig(status: InquiryStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: INQUIRY_STATUS_LABELS.PENDING,
        bg: colors.warningLight,
        color: colors.warningDark,
      };
    case 'ESCALATED':
      return {
        label: INQUIRY_STATUS_LABELS.ESCALATED,
        bg: '#f3e8ff',
        color: '#6b21a8',
      };
    case 'REPLIED':
      return {
        label: INQUIRY_STATUS_LABELS.REPLIED,
        bg: colors.successLight,
        color: colors.successDark,
      };
    case 'CANCELLED':
    default:
      return {
        label: INQUIRY_STATUS_LABELS.CANCELLED,
        bg: '#e2e8f0',
        color: '#475569',
      };
  }
}

export function formatArabicDateTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const InquiriesScreen: React.FC<Props> = ({ route, navigation }) => {
  const isFocused = useIsFocused();
  const { selectedChild, selectedSubjectId } = useChildStore();
  const initialStudentIdParam = route.params?.studentId;

  const { data: familyData, isLoading: isLoadingFamily } = useQuery({
    queryKey: ['family-overview'],
    queryFn: HomeApi.getFamilyOverview,
    staleTime: 30_000,
  });

  // Extract standalone teacher enrollments only (exclude Center students/packages)
  const { teacherEnrollments, hasExcludedCenterEnrollments } = useMemo(() => {
    const list: TeacherEnrollmentOption[] = [];
    let excludedCenter = false;
    const children = familyData?.children ?? (selectedChild ? [selectedChild] : []);

    for (const child of children) {
      if ((child as any).isCenter) {
        excludedCenter = true;
        continue;
      }
      const subjects = child.subjects ?? [];
      for (const sub of subjects) {
        if (sub.isCenter || sub.isPackage) {
          excludedCenter = true;
          continue;
        }
        if (sub.studentId && !list.some((item) => item.studentId === sub.studentId)) {
          list.push({
            studentId: sub.studentId,
            studentName: child.studentName || 'طالب',
            teacherName: sub.teacherName || 'المعلم',
            subject: sub.subject || 'المادة',
            groupName: sub.groupName || '',
            gradeLevel: child.gradeLevel || '',
          });
        }
      }
    }

    return {
      teacherEnrollments: list,
      hasExcludedCenterEnrollments: excludedCenter,
    };
  }, [familyData, selectedChild]);

  const [manualStudentId, setManualStudentId] = useState<string | null>(
    initialStudentIdParam || null
  );
  const [page, setPage] = useState<number>(1);

  const activeEnrollment = useMemo(() => {
    if (teacherEnrollments.length === 0) return null;
    if (manualStudentId) {
      const found = teacherEnrollments.find((e) => e.studentId === manualStudentId);
      if (found) return found;
    }
    if (selectedSubjectId) {
      const found = teacherEnrollments.find((e) => e.studentId === selectedSubjectId);
      if (found) return found;
    }
    return teacherEnrollments[0] ?? null;
  }, [teacherEnrollments, manualStudentId, selectedSubjectId]);

  const activeStudentId = activeEnrollment?.studentId;

  const {
    data: inquiriesData,
    isLoading: isLoadingInquiries,
    isRefetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['parent-inquiries', activeStudentId, page],
    queryFn: () =>
      InquiriesApi.getInquiries({
        studentId: activeStudentId,
        page,
        limit: 20,
      }),
    enabled: !!activeStudentId,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      if (!isFocused) return false;
      const hasOpen = query.state.data?.activeInquiry?.isOpen === true;
      return hasOpen ? 30_000 : false;
    },
  });

  const activeInquiry = inquiriesData?.activeInquiry ?? null;
  const inquiries = inquiriesData?.inquiries ?? [];
  const totalPages = inquiriesData?.totalPages ?? 1;

  const handleOpenCompose = () => {
    if (!activeEnrollment || activeInquiry) return;
    navigation.navigate('InquiryCompose', {
      mode: 'create',
      studentId: activeEnrollment.studentId,
      studentName: `${activeEnrollment.studentName} — ${activeEnrollment.subject}`,
    });
  };

  const renderStatusIcon = (status: InquiryStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock size={14} color={colors.warningDark} />;
      case 'ESCALATED':
        return <ArrowUpRight size={14} color="#6b21a8" />;
      case 'REPLIED':
        return <CheckCircle2 size={14} color={colors.successDark} />;
      case 'CANCELLED':
      default:
        return <XCircle size={14} color="#475569" />;
    }
  };

  const renderItem = ({ item }: { item: ParentInquiry }) => {
    const statusCfg = getStatusVisualConfig(item.status);
    const categoryLabel =
      INQUIRY_CATEGORY_LABELS[item.category] || item.category;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() =>
          navigation.navigate('InquiryDetail', { inquiryId: item._id })
        }
        style={styles.inquiryCard}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            {renderStatusIcon(item.status)}
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
              {statusCfg.label}
            </Text>
          </View>

          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
          </View>
        </View>

        <Text style={styles.bodyPreview} numberOfLines={2}>
          {item.body}
        </Text>

        {item.status === 'REPLIED' && item.reply && (
          <View style={styles.replyPreviewBox}>
            <View style={styles.replyPreviewHeader}>
              <CheckCircle2 size={13} color={colors.successDark} />
              <Text style={styles.replyPreviewTitle}>
                رد {item.reply.repliedByRole === 'teacher' ? 'المستر' : 'الأسيستنت'} (
                {item.reply.repliedByName}):
              </Text>
            </View>
            <Text style={styles.replyPreviewText} numberOfLines={2}>
              {item.reply.body}
            </Text>
          </View>
        )}

        <View style={styles.cardFooterRow}>
          <View style={styles.detailsLinkRow}>
            <ChevronLeft size={14} color={colors.primary} />
            <Text style={styles.detailsLinkText}>التفاصيل</Text>
          </View>
          <Text style={styles.dateText}>
            {formatArabicDateTime(item.createdAt)}
            {item.editCount > 0 ? ` • معدّل (${item.editCount})` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoadingFamily && teacherEnrollments.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>جاري تحميل بيانات الطلاب...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (teacherEnrollments.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.centerBox}>
          <MessageSquare size={46} color={colors.skyBlue} />
          <Text style={styles.emptyTitle}>
            ميزة الاستفسارات متاحة لطلاب المعلمين المستقلين
          </Text>
          <Text style={styles.emptySub}>
            لا يوجد حالياً اشتراك مع معلم مستقل يدعم نظام الاستفسارات المباشرة.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        {/* ── Student / Teacher Selector Pills ── */}
        {teacherEnrollments.length > 1 && (
          <View style={styles.selectorWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorScroll}
            >
              {teacherEnrollments.map((item) => {
                const isSelected = item.studentId === activeStudentId;
                return (
                  <TouchableOpacity
                    key={item.studentId}
                    activeOpacity={0.8}
                    onPress={() => {
                      setManualStudentId(item.studentId);
                      setPage(1);
                    }}
                    style={[
                      styles.selectorPill,
                      isSelected && styles.selectorPillActive,
                    ]}
                  >
                    <User
                      size={13}
                      color={isSelected ? colors.navy : '#ffffff'}
                    />
                    <Text
                      style={[
                        styles.selectorPillText,
                        isSelected && styles.selectorPillTextActive,
                      ]}
                    >
                      {item.studentName} — {item.subject} (أ. {item.teacherName})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Current Student / Teacher Banner */}
        {activeEnrollment && (
          <View style={styles.currentTargetBar}>
            <View style={styles.currentTargetTextWrap}>
              <Text style={styles.currentTargetTitle}>
                {activeEnrollment.studentName} • {activeEnrollment.subject}
              </Text>
              <Text style={styles.currentTargetSub}>
                أ. {activeEnrollment.teacherName}
                {activeEnrollment.groupName
                  ? ` — ${activeEnrollment.groupName}`
                  : ''}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!!activeInquiry}
              onPress={handleOpenCompose}
              style={[
                styles.newInquiryBtn,
                !!activeInquiry && styles.newInquiryBtnDisabled,
              ]}
            >
              <Plus size={16} color={ activeInquiry ? '#94a3b8' : colors.navy } />
              <Text
                style={[
                  styles.newInquiryBtnText,
                  !!activeInquiry && styles.newInquiryBtnTextDisabled,
                ]}
              >
                طلب جديد
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {hasExcludedCenterEnrollments && (
          <View style={styles.infoNoteRow}>
            <Info size={13} color={colors.skyBlue} />
            <Text style={styles.infoNoteText}>
              ملاحظة: تظهر هنا مواد المعلمين المستقلين فقط (لا تشمل اشتراكات السنتر).
            </Text>
          </View>
        )}

        {/* ── Active Inquiry Prominent Section ── */}
        {activeInquiry && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() =>
              navigation.navigate('InquiryDetail', {
                inquiryId: activeInquiry._id,
              })
            }
            style={styles.activeBannerCard}
          >
            <View style={styles.activeBannerHeader}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusVisualConfig(activeInquiry.status)
                      .bg,
                  },
                ]}
              >
                {renderStatusIcon(activeInquiry.status)}
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color: getStatusVisualConfig(activeInquiry.status).color,
                    },
                  ]}
                >
                  {getStatusVisualConfig(activeInquiry.status).label}
                </Text>
              </View>
              <Text style={styles.activeBannerTitle}>الطلب النشط الحالي</Text>
            </View>

            <Text style={styles.activeBannerCategory}>
              التصنيف:{' '}
              {INQUIRY_CATEGORY_LABELS[activeInquiry.category] ||
                activeInquiry.category}
            </Text>

            <Text style={styles.activeBannerBody} numberOfLines={2}>
              {activeInquiry.body}
            </Text>

            <View style={styles.activeBannerFooter}>
              <Text style={styles.activeBannerCTA}>
                {activeInquiry.status === 'PENDING'
                  ? `عرض أو تعديل (متبقي ${
                      MAX_INQUIRY_EDITS - activeInquiry.editCount
                    } تعديلات) ←`
                  : 'عرض تفاصيل الطلب المحوّل للمستر ←'}
              </Text>
              <Text style={styles.activeBannerHint}>
                يُفتح إرسال طلب جديد فور الرد على هذا الطلب
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── History List ── */}
        {isLoadingInquiries ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.skyBlue} />
            <Text style={styles.loadingText}>جاري تحميل سجل الاستفسارات...</Text>
          </View>
        ) : isError ? (
          <View style={styles.centerBox}>
            <AlertCircle size={38} color={colors.danger} />
            <Text style={styles.emptyTitle}>تعذر تحميل الاستفسارات</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => refetch()}
            >
              <Text style={styles.retryBtnText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={inquiries}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={colors.skyBlue}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyListBox}>
                <MessageSquare size={42} color={colors.skyBlue} />
                <Text style={styles.emptyTitle}>لا توجد استفسارات سابقة</Text>
                <Text style={styles.emptySub}>
                  يمكنك إرسال اعتذار عن غياب أو استفسار عن الدرجات أو الاشتراك
                  ليقوم المعلم أو المساعد بالرد عليك هنا.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={handleOpenCompose}
                >
                  <Plus size={16} color={colors.navy} />
                  <Text style={styles.emptyActionBtnText}>
                    إرسال أول استفسار
                  </Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={
              totalPages > 1 ? (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    disabled={page >= totalPages}
                    onPress={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    style={[
                      styles.pageBtn,
                      page >= totalPages && styles.pageBtnDisabled,
                    ]}
                  >
                    <Text style={styles.pageBtnText}>التالي</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageInfoText}>
                    صفحة {page} من {totalPages}
                  </Text>

                  <TouchableOpacity
                    disabled={page <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    style={[
                      styles.pageBtn,
                      page <= 1 && styles.pageBtnDisabled,
                    ]}
                  >
                    <Text style={styles.pageBtnText}>السابق</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
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
  selectorWrap: {
    marginBottom: spacing.sm,
  },
  selectorScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
  },
  selectorPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.navyMid,
    borderWidth: 1,
    borderColor: colors.navyLight,
  },
  selectorPillActive: {
    backgroundColor: colors.skyBlue,
    borderColor: colors.skyBlue,
  },
  selectorPillText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  selectorPillTextActive: {
    color: colors.navy,
  },
  currentTargetBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navyMid,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.navyLight,
    marginBottom: spacing.sm,
  },
  currentTargetTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  currentTargetTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'right',
  },
  currentTargetSub: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.skyBlue,
    textAlign: 'right',
    marginTop: 2,
  },
  newInquiryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  newInquiryBtnDisabled: {
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  newInquiryBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.navy,
  },
  newInquiryBtnTextDisabled: {
    color: '#94a3b8',
  },
  infoNoteRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  infoNoteText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'right',
  },
  activeBannerCard: {
    backgroundColor: '#fef9c3',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#facc15',
    marginBottom: spacing.md,
  },
  activeBannerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  activeBannerTitle: {
    fontFamily: typography.extraBold,
    fontSize: 14,
    color: colors.navy,
  },
  activeBannerCategory: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'right',
    marginBottom: 4,
  },
  activeBannerBody: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 19,
  },
  activeBannerFooter: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(11,35,68,0.1)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  activeBannerCTA: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  activeBannerHint: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.warningDark,
  },
  listContent: {
    paddingBottom: 60,
  },
  inquiryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontFamily: typography.bold,
    fontSize: 11,
    color: colors.primary,
  },
  bodyPreview: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 20,
  },
  replyPreviewBox: {
    marginTop: 8,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  replyPreviewHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  replyPreviewTitle: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.successDark,
  },
  replyPreviewText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.text,
    textAlign: 'right',
    lineHeight: 18,
  },
  cardFooterRow: {
    marginTop: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  detailsLinkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  detailsLinkText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.primary,
  },
  emptyListBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: typography.bold,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptySub: {
    fontFamily: typography.regular,
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  emptyActionBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  emptyActionBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.navy,
  },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.skyBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.navy,
  },
  paginationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageBtn: {
    backgroundColor: colors.navyMid,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.navyLight,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  pageInfoText: {
    fontFamily: typography.medium,
    fontSize: 12,
    color: '#cbd5e1',
  },
});
