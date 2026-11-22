import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { InquiriesApi } from '../../api/inquiries.api';
import { HomeApi } from '../../api/home.api';
import { useChildStore } from '../../store/child.store';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { showAlert } from '../../utils/alert.util';
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_CATEGORY_OPTIONS,
  InquiryCategory,
  MAX_INQUIRY_BODY_LENGTH,
  MAX_INQUIRY_EDITS,
} from '../../types/inquiry.types';
import { TeacherEnrollmentOption } from './InquiriesScreen';
import { Send, Edit3, User, Tag, Info } from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'InquiryCompose'>;

function generateClientRequestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `pinq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export const InquiryComposeScreen: React.FC<Props> = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const { selectedChild } = useChildStore();
  const {
    mode,
    studentId: initialStudentId,
    inquiryId,
    initialBody = '',
    initialCategory = 'GENERAL',
    editCount = 0,
  } = route.params;

  const isEditMode = mode === 'edit';

  const { data: familyData } = useQuery({
    queryKey: ['family-overview'],
    queryFn: HomeApi.getFamilyOverview,
    staleTime: 30_000,
  });

  const teacherEnrollments = useMemo(() => {
    const list: TeacherEnrollmentOption[] = [];
    const children = familyData?.children ?? (selectedChild ? [selectedChild] : []);
    for (const child of children) {
      if ((child as any).isCenter) continue;
      for (const sub of child.subjects ?? []) {
        if (sub.isCenter || sub.isPackage) continue;
        if (sub.studentId && !list.some((e) => e.studentId === sub.studentId)) {
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
    return list;
  }, [familyData, selectedChild]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || teacherEnrollments[0]?.studentId || ''
  );
  const [category, setCategory] = useState<InquiryCategory>(
    (initialCategory as InquiryCategory) || 'GENERAL'
  );
  const [body, setBody] = useState<string>(initialBody);
  const [clientRequestId, setClientRequestId] = useState<string>(() =>
    generateClientRequestId()
  );

  const effectiveStudentId =
    selectedStudentId || teacherEnrollments[0]?.studentId || '';

  const handleSelectStudent = (sid: string) => {
    setSelectedStudentId(sid);
    setClientRequestId(generateClientRequestId());
  };

  const handleSelectCategory = (cat: InquiryCategory) => {
    setCategory(cat);
    setClientRequestId(generateClientRequestId());
  };

  const handleChangeBody = (text: string) => {
    setBody(text);
    setClientRequestId(generateClientRequestId());
  };

  const createMutation = useMutation({
    mutationFn: () =>
      InquiriesApi.createInquiry({
        studentId: effectiveStudentId,
        category,
        body: body.trim(),
        clientRequestId,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
      showAlert('تم الإرسال', 'تم إرسال استفسارك بنجاح وسيتم الرد عليك قريباً.', () => {
        navigation.replace('InquiryDetail', { inquiryId: created._id });
      });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.code;
      const msg =
        err?.response?.data?.message ||
        'تعذر إرسال الطلب حالياً، يرجى المحاولة مرة أخرى.';
      const existingActiveId = err?.response?.data?.data?.activeInquiryId;

      if (code === 'ACTIVE_INQUIRY_EXISTS') {
        queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
        showAlert('يوجد طلب نشط', msg, () => {
          if (existingActiveId) {
            navigation.replace('InquiryDetail', {
              inquiryId: existingActiveId,
            });
          } else {
            navigation.goBack();
          }
        });
        return;
      }

      showAlert('تنبيه', msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => InquiriesApi.updateInquiry(inquiryId!, body.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
      if (inquiryId) {
        queryClient.invalidateQueries({
          queryKey: ['parent-inquiry-detail', inquiryId],
        });
      }
      showAlert('تم التعديل', 'تم حفظ تعديل نص الطلب بنجاح.', () => {
        navigation.goBack();
      });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        'تعذر تعديل الطلب، قد يكون تم الرد عليه أو تحويله للمستر.';
      queryClient.invalidateQueries({ queryKey: ['parent-inquiries'] });
      if (inquiryId) {
        queryClient.invalidateQueries({
          queryKey: ['parent-inquiry-detail', inquiryId],
        });
      }
      showAlert('تعذر التعديل', msg, () => {
        navigation.goBack();
      });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (isSubmitting) return;
    const cleanBody = body.trim();
    if (!cleanBody) {
      showAlert('تنبيه', 'يرجى كتابة نص الرسالة أولاً.');
      return;
    }
    if (cleanBody.length > MAX_INQUIRY_BODY_LENGTH) {
      showAlert('تنبيه', 'نص الرسالة يجب ألا يتجاوز 1000 حرف.');
      return;
    }

    if (isEditMode) {
      if (!inquiryId) return;
      updateMutation.mutate();
    } else {
      if (!effectiveStudentId) {
        showAlert('تنبيه', 'يرجى اختيار الطالب والمادة أولاً.');
        return;
      }
      createMutation.mutate();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Edit Mode Banner ── */}
          {isEditMode ? (
            <View style={styles.infoBanner}>
              <Info size={16} color={colors.primary} />
              <View style={styles.infoBannerTextWrap}>
                <Text style={styles.infoBannerTitle}>
                  تعديل نص الطلب ({INQUIRY_CATEGORY_LABELS[category] || category})
                </Text>
                <Text style={styles.infoBannerSub}>
                  متبقي لك {Math.max(0, MAX_INQUIRY_EDITS - editCount)} من أصل{' '}
                  {MAX_INQUIRY_EDITS} تعديلات مسموحة قبل رد الأسيستنت أو المستر.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* ── 1. Student & Subject Selection ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <User size={16} color={colors.skyBlue} />
                  <Text style={styles.sectionTitle}>الطالب والمادة:</Text>
                </View>
                <View style={styles.optionsGrid}>
                  {teacherEnrollments.map((item) => {
                    const isSelected = item.studentId === effectiveStudentId;
                    return (
                      <TouchableOpacity
                        key={item.studentId}
                        activeOpacity={0.8}
                        onPress={() => handleSelectStudent(item.studentId)}
                        style={[
                          styles.optionCard,
                          isSelected && styles.optionCardSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionCardTitle,
                            isSelected && styles.optionCardTitleSelected,
                          ]}
                        >
                          {item.studentName} — {item.subject}
                        </Text>
                        <Text
                          style={[
                            styles.optionCardSub,
                            isSelected && styles.optionCardSubSelected,
                          ]}
                        >
                          أ. {item.teacherName}
                          {item.groupName ? ` (${item.groupName})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── 2. Category Selection ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Tag size={16} color={colors.skyBlue} />
                  <Text style={styles.sectionTitle}>تصنيف الطلب:</Text>
                </View>
                <View style={styles.categoriesWrap}>
                  {INQUIRY_CATEGORY_OPTIONS.map((opt) => {
                    const isSelected = opt.value === category;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        activeOpacity={0.8}
                        onPress={() => handleSelectCategory(opt.value)}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* ── 3. Message Body Input ── */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.charCount}>
                {body.length} / {MAX_INQUIRY_BODY_LENGTH} حرف
              </Text>
              <Text style={styles.sectionTitle}>تفاصيل الرسالة:</Text>
            </View>

            <TextInput
              style={styles.textArea}
              value={body}
              onChangeText={handleChangeBody}
              placeholder="اكتب استفسارك أو اعتذارك بوضوح هنا..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={MAX_INQUIRY_BODY_LENGTH}
              textAlign="right"
              textAlignVertical="top"
            />
          </View>

          {/* ── Submit Button ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isSubmitting || !body.trim()}
            onPress={handleSubmit}
            style={[
              styles.submitBtn,
              (isSubmitting || !body.trim()) && styles.submitBtnDisabled,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.navy} />
            ) : (
              <>
                {isEditMode ? (
                  <Edit3 size={18} color={colors.navy} />
                ) : (
                  <Send size={18} color={colors.navy} />
                )}
                <Text style={styles.submitBtnText}>
                  {isEditMode ? 'حفظ التعديل' : 'إرسال الطلب'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  infoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBannerTextWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  infoBannerTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: colors.navy,
    textAlign: 'right',
  },
  infoBannerSub: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'right',
  },
  optionsGrid: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: colors.navyMid,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.navyLight,
    alignItems: 'flex-end',
  },
  optionCardSelected: {
    backgroundColor: colors.card,
    borderColor: colors.skyBlue,
  },
  optionCardTitle: {
    fontFamily: typography.bold,
    fontSize: 14,
    color: '#ffffff',
    textAlign: 'right',
  },
  optionCardTitleSelected: {
    color: colors.navy,
  },
  optionCardSub: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'right',
    marginTop: 2,
  },
  optionCardSubSelected: {
    color: colors.primary,
  },
  categoriesWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: colors.navyMid,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.navyLight,
  },
  categoryChipSelected: {
    backgroundColor: colors.skyBlue,
    borderColor: colors.skyBlue,
  },
  categoryChipText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: '#ffffff',
  },
  categoryChipTextSelected: {
    color: colors.navy,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  charCount: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#cbd5e1',
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 160,
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    lineHeight: 22,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.skyBlue,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    fontFamily: typography.extraBold,
    fontSize: 15,
    color: colors.navy,
  },
});
