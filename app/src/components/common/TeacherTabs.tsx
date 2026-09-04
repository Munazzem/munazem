import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { UserCheck } from 'lucide-react-native';

export interface TeacherTabItem {
  studentId: string;
  teacherId?: string;
  teacherName: string;
  subject: string;
  groupName?: string;
}

interface TeacherTabsProps {
  subjects: TeacherTabItem[];
  selectedSubjectId: string | null;
  onSelect: (studentId: string) => void;
  variant?: 'navy' | 'light';
  title?: string;
}

export const TeacherTabs: React.FC<TeacherTabsProps> = ({
  subjects,
  selectedSubjectId,
  onSelect,
  variant = 'navy',
  title = 'المعلم والمادة:',
}) => {
  if (!subjects || subjects.length <= 1) {
    return null;
  }

  const isNavy = variant === 'navy';

  return (
    <View style={[styles.container, isNavy ? styles.containerNavy : styles.containerLight]}>
      {title ? (
        <Text style={[styles.title, isNavy ? styles.titleNavy : styles.titleLight]}>
          {title}
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {subjects.map((subj, idx) => {
          const isSelected =
            selectedSubjectId === subj.studentId || (!selectedSubjectId && idx === 0);

          return (
            <TouchableOpacity
              key={subj.studentId || idx}
              onPress={() => onSelect(subj.studentId)}
              style={[
                styles.tab,
                isNavy ? styles.tabNavy : styles.tabLight,
                isSelected && (isNavy ? styles.tabActiveNavy : styles.tabActiveLight),
              ]}
              activeOpacity={0.8}
            >
              <View style={styles.tabContent}>
                {isSelected && (
                  <UserCheck
                    size={14}
                    color={isNavy ? colors.skyBlue : colors.primary}
                    style={styles.icon}
                  />
                )}
                <View>
                  <Text
                    style={[
                      styles.tabName,
                      isNavy ? styles.tabNameNavy : styles.tabNameLight,
                      isSelected &&
                        (isNavy ? styles.tabNameActiveNavy : styles.tabNameActiveLight),
                    ]}
                  >
                    {subj.teacherName ? `أ. ${subj.teacherName}` : 'المعلم'}
                  </Text>
                  <Text
                    style={[
                      styles.tabSub,
                      isNavy ? styles.tabSubNavy : styles.tabSubLight,
                      isSelected &&
                        (isNavy ? styles.tabSubActiveNavy : styles.tabSubActiveLight),
                    ]}
                  >
                    {subj.subject || subj.groupName}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  containerNavy: {
    marginTop: spacing.sm,
  },
  containerLight: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  title: {
    fontFamily: typography.medium,
    fontSize: 12,
    marginBottom: spacing.xs,
    textAlign: 'right',
  },
  titleNavy: {
    color: '#94a3b8',
  },
  titleLight: {
    color: colors.textMuted,
  },
  scrollContent: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  tab: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    marginLeft: 2,
  },
  tabNavy: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tabActiveNavy: {
    backgroundColor: 'rgba(56,189,248,0.2)',
    borderColor: colors.skyBlue,
  },
  tabLight: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActiveLight: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabName: {
    fontSize: 13,
    fontFamily: typography.bold,
    textAlign: 'right',
  },
  tabNameNavy: {
    color: colors.textInverse,
  },
  tabNameActiveNavy: {
    color: colors.skyBlue,
  },
  tabNameLight: {
    color: colors.text,
  },
  tabNameActiveLight: {
    color: colors.primaryDark,
  },
  tabSub: {
    fontSize: 11,
    fontFamily: typography.regular,
    marginTop: 1,
    textAlign: 'right',
  },
  tabSubNavy: {
    color: '#cbd5e1',
  },
  tabSubActiveNavy: {
    color: '#e0f2fe',
  },
  tabSubLight: {
    color: colors.textMuted,
  },
  tabSubActiveLight: {
    color: colors.primary,
  },
});
