import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ChildrenApi } from '../../api/children.api';
import {
  SubjectEnrollment,
  AttendanceRecord,
  ExamRecord,
  FinancialRecord,
} from '../../types/child.types';
import { colors } from '../../theme/colors';
import { typography, textStyles } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentQrCardModal } from '../../components/common/StudentQrCardModal';
import {
  CalendarCheck,
  Award,
  Wallet,
  QrCode as QrIcon,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Calendar,
  Receipt,
} from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildDetails'>;

type TabType = 'attendance' | 'exams' | 'financial';

export const ChildDetailsScreen: React.FC<Props> = ({ route }) => {
  const { studentId, studentName, initialTab = 'attendance' } = route.params;
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // 1. Fetch Child Subjects
  const {
    data: subjects = [],
    isLoading: isLoadingSubjects,
    refetch: refetchSubjects,
  } = useQuery({
    queryKey: ['child-subjects', studentId],
    queryFn: () => ChildrenApi.getChildSubjects(studentId),
  });

  // 2. Fetch Attendance
  const {
    data: attendanceRecords = [],
    isLoading: isLoadingAttendance,
    refetch: refetchAttendance,
    isRefetching: isRefetchingAttendance,
  } = useQuery({
    queryKey: ['child-attendance', studentId, selectedSubjectId],
    queryFn: () =>
      ChildrenApi.getAttendance(studentId, {
        subjectId: selectedSubjectId || undefined,
      }),
  });

  // 3. Fetch Exams
  const {
    data: examRecords = [],
    isLoading: isLoadingExams,
    refetch: refetchExams,
    isRefetching: isRefetchingExams,
  } = useQuery({
    queryKey: ['child-exams', studentId, selectedSubjectId],
    queryFn: () =>
      ChildrenApi.getExams(studentId, {
        subjectId: selectedSubjectId || undefined,
      }),
  });

  // 4. Fetch Financial
  const {
    data: financialRecords = [],
    isLoading: isLoadingFinancial,
    refetch: refetchFinancial,
    isRefetching: isRefetchingFinancial,
  } = useQuery({
    queryKey: ['child-financial', studentId, selectedSubjectId],
    queryFn: () =>
      ChildrenApi.getFinancial(studentId, {
        subjectId: selectedSubjectId || undefined,
      }),
  });

  const handleRefreshAll = () => {
    refetchSubjects();
    refetchAttendance();
    refetchExams();
    refetchFinancial();
  };

  const isRefreshing =
    isRefetchingAttendance || isRefetchingExams || isRefetchingFinancial;

  // Active student card details
  const primarySubject = subjects[0];
  const cardData = {
    studentId,
    studentName,
    gradeLevel: primarySubject?.gradeLevel || '',
    studentCode: primarySubject?.studentCode || '',
    barcode: primarySubject?.barcode || '',
    qrValue: primarySubject?.qrValue || primarySubject?.barcode || studentId,
    teacherName: primarySubject?.teacherName || '',
    subject: primarySubject?.subject || '',
    centerName: primarySubject?.centerName || '',
    groupName: primarySubject?.groupName || '',
  };

  const uniqueSubjectNames = new Set(subjects.map((s: SubjectEnrollment) => s.subject)).size;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Child Summary Header */}
        <View style={styles.childHeader}>
          <View style={styles.childInfo}>
            <Text style={styles.studentName} numberOfLines={1}>
              {studentName}
            </Text>
            <Text style={styles.studentMeta}>
              {primarySubject?.gradeLevel || 'طالب مسجل'} •{' '}
              {uniqueSubjectNames === 1 ? 'مادة دراسية واحدة' : `${uniqueSubjectNames} مواد دراسية`}
              {subjects.length > uniqueSubjectNames ? ` (${subjects.length} اشتراكات)` : ''}
            </Text>
          </View>

          {/* QR Card Action Button */}
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.8}
          >
            <QrIcon size={18} color={colors.textInverse} />
            <Text style={styles.qrBtnText}>كارت الطالب</Text>
          </TouchableOpacity>
        </View>

        {/* Subject Filter Pills */}
        {subjects.length > 0 && (
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSelectedSubjectId(null)}
                style={[
                  styles.filterPill,
                  selectedSubjectId === null && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selectedSubjectId === null && styles.filterPillTextActive,
                  ]}
                >
                  الكل ({subjects.length})
                </Text>
              </TouchableOpacity>

              {subjects.map((sub: SubjectEnrollment) => {
                const hasDuplicateSubjectTeacher =
                  subjects.filter(
                    (s: SubjectEnrollment) =>
                      s.teacherName === sub.teacherName &&
                      s.subject === sub.subject
                  ).length > 1;

                const pillLabel = hasDuplicateSubjectTeacher
                  ? `${sub.subject} (${sub.teacherName} - ${
                      sub.studentCode ? `كود ${sub.studentCode}` : sub.groupName
                    })`
                  : `${sub.subject} (${sub.teacherName})`;

                return (
                  <TouchableOpacity
                    key={sub.studentId}
                    activeOpacity={0.7}
                    onPress={() => setSelectedSubjectId(sub.studentId)}
                    style={[
                      styles.filterPill,
                      selectedSubjectId === sub.studentId &&
                        styles.filterPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedSubjectId === sub.studentId &&
                          styles.filterPillTextActive,
                      ]}
                    >
                      {pillLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Module Tabs (Attendance, Exams, Financial) */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('attendance')}
            style={[
              styles.tabButton,
              activeTab === 'attendance' && styles.tabButtonActive,
            ]}
          >
            <CalendarCheck
              size={18}
              color={activeTab === 'attendance' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'attendance' && styles.tabTextActive,
              ]}
            >
              الحضور
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('exams')}
            style={[
              styles.tabButton,
              activeTab === 'exams' && styles.tabButtonActive,
            ]}
          >
            <Award
              size={18}
              color={activeTab === 'exams' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'exams' && styles.tabTextActive,
              ]}
            >
              الامتحانات
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setActiveTab('financial')}
            style={[
              styles.tabButton,
              activeTab === 'financial' && styles.tabButtonActive,
            ]}
          >
            <Wallet
              size={18}
              color={activeTab === 'financial' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'financial' && styles.tabTextActive,
              ]}
            >
              الماليات
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content Display */}
        <ScrollView
          contentContainerStyle={[styles.tabContent, { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefreshAll}
              tintColor={colors.primary}
            />
          }
        >
          {/* TAB 1: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <View>
              {isLoadingAttendance ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : attendanceRecords.length > 0 ? (
                attendanceRecords.map((item: AttendanceRecord) => {
                  const isPresent = item.status === 'PRESENT';
                  const isLate = item.status === 'LATE';
                  const isAbsent = item.status === 'ABSENT';

                  return (
                    <Card key={item.id} variant="elevated" style={styles.recordCard}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.subjectWrapper}>
                          <Text style={styles.cardSubject}>{item.subject}</Text>
                          <Text style={styles.cardTeacher}>مع: {item.teacherName}</Text>
                        </View>

                        {isPresent && (
                          <Badge
                            label="حاضر ✓"
                            variant="success"
                            icon={<CheckCircle2 size={13} color={colors.successDark} />}
                          />
                        )}
                        {isLate && (
                          <Badge
                            label="متأخر"
                            variant="warning"
                            icon={<Clock size={13} color={colors.warningDark} />}
                          />
                        )}
                        {isAbsent && (
                          <Badge
                            label="غائب ✗"
                            variant="danger"
                            icon={<XCircle size={13} color={colors.dangerDark} />}
                          />
                        )}
                      </View>

                      <View style={styles.cardBottomRow}>
                        <View style={styles.metaItem}>
                          <Calendar size={14} color={colors.textSecondary} />
                          <Text style={styles.metaItemText}>
                            {new Date(item.date).toLocaleDateString('ar-EG', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>

                        {item.groupName ? (
                          <View style={styles.metaItem}>
                            <BookOpen size={14} color={colors.textSecondary} />
                            <Text style={styles.metaItemText}>{item.groupName}</Text>
                          </View>
                        ) : null}
                      </View>

                      {item.notes ? (
                        <View style={styles.notesBox}>
                          <Text style={styles.notesText}>ملاحظة: {item.notes}</Text>
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              ) : (
                <EmptyState
                  title="لا توجد حصص مسجلة"
                  description="لم يتم تسجيل حضور أو غياب لهذا الطالب في المواد المحددة بعد."
                  icon={<CalendarCheck size={48} color={colors.primary} />}
                />
              )}
            </View>
          )}

          {/* TAB 2: EXAMS */}
          {activeTab === 'exams' && (
            <View>
              {isLoadingExams ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : examRecords.length > 0 ? (
                examRecords.map((exam: ExamRecord) => (
                  <Card key={exam.id} variant="elevated" style={styles.recordCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.subjectWrapper}>
                        <Text style={styles.cardSubject}>{exam.title}</Text>
                        <Text style={styles.cardTeacher}>
                          {exam.subject} • المعلم: {exam.teacherName}
                        </Text>
                      </View>

                      <View style={styles.scoreContainer}>
                        <Text
                          style={[
                            styles.scoreText,
                            exam.passed ? { color: colors.success } : { color: colors.danger },
                          ]}
                        >
                          {exam.score} / {exam.totalMarks}
                        </Text>
                        <Badge
                          label={`${exam.percentage}% ${exam.passed ? 'ناجح' : 'راسب'}`}
                          variant={exam.passed ? 'success' : 'danger'}
                        />
                      </View>
                    </View>

                    <View style={styles.cardBottomRow}>
                      <View style={styles.metaItem}>
                        <Calendar size={14} color={colors.textSecondary} />
                        <Text style={styles.metaItemText}>
                          {new Date(exam.date).toLocaleDateString('ar-EG', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Award size={14} color={colors.textSecondary} />
                        <Text style={styles.metaItemText}>
                          درجة النجاح: {exam.passingMarks}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="لا توجد نتائج امتحانات"
                  description="لم يتم رصد درجات امتحانات مسجلة لهذا الطالب حتى الآن."
                  icon={<Award size={48} color={colors.primary} />}
                />
              )}
            </View>
          )}

          {/* TAB 3: FINANCIAL */}
          {activeTab === 'financial' && (
            <View>
              {isLoadingFinancial ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : financialRecords.length > 0 ? (
                financialRecords.map((fin: FinancialRecord, idx: number) => (
                  <Card key={idx} variant="elevated" style={styles.recordCard}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.subjectWrapper}>
                        <Text style={styles.cardSubject}>
                          الدورة رقم {fin.cycleNumber} ({fin.subject})
                        </Text>
                        <Text style={styles.cardTeacher}>المعلم: {fin.teacherName}</Text>
                      </View>

                      <Badge
                        label={
                          fin.remainingAmount > 0
                            ? `متبقي ${fin.remainingAmount} ج`
                            : 'مدفوعة بالكامل ✓'
                        }
                        variant={fin.remainingAmount > 0 ? 'danger' : 'success'}
                      />
                    </View>

                    {/* Cycle Progress & Numbers */}
                    <View style={styles.financialNumbersRow}>
                      <View style={styles.finStatBox}>
                        <Text style={styles.finStatValue}>{fin.fullCyclePrice} ج</Text>
                        <Text style={styles.finStatLabel}>سعر الدورة</Text>
                      </View>
                      <View style={styles.finDivider} />
                      <View style={styles.finStatBox}>
                        <Text style={[styles.finStatValue, { color: colors.success }]}>
                          {fin.totalPaid} ج
                        </Text>
                        <Text style={styles.finStatLabel}>المدفوع</Text>
                      </View>
                      <View style={styles.finDivider} />
                      <View style={styles.finStatBox}>
                        <Text style={styles.finStatValue}>
                          {fin.sessionsConsumed} / {fin.cycleCapacity}
                        </Text>
                        <Text style={styles.finStatLabel}>الحصص</Text>
                      </View>
                    </View>

                    {/* Payments History */}
                    {fin.payments && fin.payments.length > 0 ? (
                      <View style={styles.paymentsSection}>
                        <View style={styles.paymentsHeader}>
                          <Receipt size={14} color={colors.textSecondary} />
                          <Text style={styles.paymentsTitle}>سجل المدفوعات:</Text>
                        </View>
                        {fin.payments.map((p: any) => (
                          <View key={p.id} style={styles.paymentRow}>
                            <Text style={styles.paymentAmount}>+ {p.amount} ج</Text>
                            <Text style={styles.paymentDate}>
                              {new Date(p.date).toLocaleDateString('ar-EG')} - {p.description}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                ))
              ) : (
                <EmptyState
                  title="لا توجد بيانات مالية"
                  description="لا توجد دورات أو مستحقات مالية مسجلة حالياً."
                  icon={<Wallet size={48} color={colors.primary} />}
                />
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Digital Smart Card Modal */}
      <StudentQrCardModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        cardData={cardData}
      />
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
  },
  loader: {
    marginVertical: spacing.xxl,
  },
  childHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  childInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  studentName: {
    ...textStyles.h2,
    color: colors.text,
  },
  studentMeta: {
    ...textStyles.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  qrBtn: {
    flexShrink: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  qrBtnText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.textInverse,
  },
  filterSection: {
    marginVertical: spacing.xs,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.primary,
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    marginTop: spacing.xs,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    gap: 6,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontFamily: typography.bold,
    fontSize: 13,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabContent: {
    padding: spacing.lg,
  },
  recordCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  cardTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  subjectWrapper: {
    alignItems: 'flex-end',
    flex: 1,
    marginLeft: spacing.sm,
  },
  cardSubject: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: colors.text,
  },
  cardTeacher: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreText: {
    fontFamily: typography.bold,
    fontSize: 16,
  },
  cardBottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  notesBox: {
    backgroundColor: colors.background,
    padding: spacing.xs,
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  notesText: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  financialNumbersRow: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
    marginVertical: spacing.sm,
  },
  finStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  finDivider: {
    width: 1,
    height: '80%',
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
  },
  finStatValue: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: colors.text,
  },
  finStatLabel: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  paymentsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.xs,
  },
  paymentsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  paymentsTitle: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  paymentRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  paymentAmount: {
    fontFamily: typography.bold,
    fontSize: 12,
    color: colors.success,
  },
  paymentDate: {
    fontFamily: typography.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
});
