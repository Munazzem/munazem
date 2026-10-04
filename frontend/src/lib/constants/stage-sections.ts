import React from 'react';
import {
    GraduationCap,
    BookOpen,
    Layers,
} from 'lucide-react';
import {
    PRIMARY_GRADES,
    PREPARATORY_GRADES,
    SECONDARY_GRADES,
} from '@/lib/constants/grade.constants';

export interface StageTheme {
    headerBg: string;
    headerBorder: string;
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    pillActive: string;
    accentBorder: string;
}

export interface StageSectionConfig {
    key: 'SECONDARY' | 'PREPARATORY' | 'PRIMARY';
    slug: 'secondary' | 'preparatory' | 'primary';
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    grades: readonly string[];
    defaultAddGrade: string;
    theme: StageTheme;
}

export const STAGE_SECTIONS: StageSectionConfig[] = [
    {
        key: 'SECONDARY',
        slug: 'secondary',
        title: 'المرحلة الثانوية',
        subtitle: 'الصف الأول، الثاني، والثالث الثانوي',
        icon: GraduationCap,
        grades: SECONDARY_GRADES,
        defaultAddGrade: SECONDARY_GRADES[0],
        theme: {
            headerBg: 'bg-gradient-to-l from-indigo-50/90 via-white to-indigo-50/20',
            headerBorder: 'border-indigo-100',
            iconBg: 'bg-indigo-600',
            iconColor: 'text-white',
            badgeBg: 'bg-indigo-50',
            badgeBorder: 'border-indigo-200',
            badgeText: 'text-indigo-700',
            pillActive: 'bg-indigo-600 text-white',
            accentBorder: 'border-indigo-300',
        },
    },
    {
        key: 'PREPARATORY',
        slug: 'preparatory',
        title: 'المرحلة الإعدادية',
        subtitle: 'الصف الأول، الثاني، والثالث الإعدادي',
        icon: BookOpen,
        grades: PREPARATORY_GRADES,
        defaultAddGrade: PREPARATORY_GRADES[0],
        theme: {
            headerBg: 'bg-gradient-to-l from-emerald-50/90 via-white to-emerald-50/20',
            headerBorder: 'border-emerald-100',
            iconBg: 'bg-emerald-600',
            iconColor: 'text-white',
            badgeBg: 'bg-emerald-50',
            badgeBorder: 'border-emerald-200',
            badgeText: 'text-emerald-700',
            pillActive: 'bg-emerald-600 text-white',
            accentBorder: 'border-emerald-300',
        },
    },
    {
        key: 'PRIMARY',
        slug: 'primary',
        title: 'المرحلة الابتدائية',
        subtitle: 'صفوف المرحلة الابتدائية (من الأول إلى السادس الابتدائي)',
        icon: Layers,
        grades: PRIMARY_GRADES,
        defaultAddGrade: PRIMARY_GRADES[0],
        theme: {
            headerBg: 'bg-gradient-to-l from-amber-50/90 via-white to-amber-50/20',
            headerBorder: 'border-amber-100',
            iconBg: 'bg-amber-600',
            iconColor: 'text-white',
            badgeBg: 'bg-amber-50',
            badgeBorder: 'border-amber-200',
            badgeText: 'text-amber-700',
            pillActive: 'bg-amber-600 text-white',
            accentBorder: 'border-amber-300',
        },
    },
];

export function getStageConfig(stageParam: string): StageSectionConfig | undefined {
    const clean = String(stageParam || '').trim().toLowerCase();
    return STAGE_SECTIONS.find(
        (s) => s.slug === clean || s.key.toLowerCase() === clean
    );
}
