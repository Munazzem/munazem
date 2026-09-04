import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ChildCardSummary } from '../../types/child.types';
import { useChildStore } from '../../store/child.store';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import {
  GraduationCap,
  Users,
  ChevronLeft,
  BookOpen,
  CheckCircle2,
} from 'lucide-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectChild'>;

export const SelectChildScreen: React.FC<Props> = ({ route, navigation }) => {
  const { children, mode = 'onboarding' } = route.params;
  const { setSelectedChild, selectedChildId } = useChildStore();

  const handleSelect = async (child: ChildCardSummary) => {
    await setSelectedChild(child);
    navigation.navigate('MainTabs', {} as any);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}>
              <Users size={22} color={colors.skyBlue} />
            </View>
            <Text style={styles.headerTitle}>
              {mode === 'switch' ? 'تبديل الطالب' : 'اختر الطالب'}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {mode === 'switch'
              ? 'اختر الطالب الذي تريد متابعته الآن'
              : 'تم ربط رقمك بأكثر من طالب — اختر من تريد متابعته'}
          </Text>
        </View>

        {/* Children Cards */}
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {children.map((child) => {
            const isSelected = child.id === selectedChildId;
            return (
              <TouchableOpacity
                key={child.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => handleSelect(child)}
                activeOpacity={0.85}
              >
                {/* Avatar */}
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  <Text style={styles.avatarText}>{child.studentName.charAt(0)}</Text>
                </View>

                {/* Info */}
                <View style={styles.info}>
                  <Text style={[styles.name, isSelected && styles.nameSelected]}>
                    {child.studentName}
                  </Text>
                  <Text style={styles.grade}>{child.gradeLevel}</Text>

                  {child.subjects?.length > 0 && (
                    <View style={styles.subjectRow}>
                      <BookOpen size={12} color={colors.skyBlue} />
                      <Text style={styles.subjectText}>
                        {child.subjects[0].teacherName} — {child.subjects[0].subject}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Right indicator */}
                <View style={styles.chevronWrap}>
                  {isSelected ? (
                    <CheckCircle2 size={22} color={colors.skyBlue} />
                  ) : (
                    <ChevronLeft size={22} color={colors.navyLight} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  logoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.navyMid,
    borderWidth: 1,
    borderColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.extraBold,
    fontSize: 26,
    color: colors.textInverse,
  },
  headerSubtitle: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'right',
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: colors.navyMid,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.navyLight,
    gap: spacing.md,
    ...shadows.md,
  },
  cardSelected: {
    borderColor: colors.skyBlue,
    backgroundColor: colors.navyRich,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.navyRich,
    borderWidth: 2,
    borderColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    borderColor: colors.skyBlue,
    backgroundColor: 'rgba(56,189,248,0.15)',
  },
  avatarText: {
    fontFamily: typography.extraBold,
    fontSize: 22,
    color: colors.textInverse,
  },
  info: {
    flex: 1,
    alignItems: 'flex-end',
  },
  name: {
    fontFamily: typography.bold,
    fontSize: 18,
    color: colors.textInverse,
  },
  nameSelected: {
    color: colors.skyBlue,
  },
  grade: {
    fontFamily: typography.medium,
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  subjectRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  subjectText: {
    fontFamily: typography.regular,
    fontSize: 12,
    color: '#64748b',
  },
  chevronWrap: {
    width: 32,
    alignItems: 'center',
  },
});
