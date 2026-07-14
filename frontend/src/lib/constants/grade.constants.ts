/**
 * Grade level constants — single source of truth.
 *
 * Replaces both:
 *  - `GradeLevel` / `ALL_GRADES` in `payment.types.ts`
 *  - `GradeLevelString` / `ALL_GRADE_LEVELS` in `lib/utils/grades.ts`
 */

export const PRIMARY_GRADES = [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي',
] as const;

export const PREPARATORY_GRADES = [
    'الصف الأول الإعدادي',
    'الصف الثاني الإعدادي',
    'الصف الثالث الإعدادي',
] as const;

export const SECONDARY_GRADES = [
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
] as const;

export const ALL_GRADES = [...PRIMARY_GRADES, ...PREPARATORY_GRADES, ...SECONDARY_GRADES] as const;

/** Union type derived from the constant — the single GradeLevel type. */
export type GradeLevel = typeof ALL_GRADES[number];

/**
 * Returns the allowed grade levels based on teacher's stage.
 *  - PRIMARY     → 6 primary grades
 *  - PREPARATORY → 3 prep grades only
 *  - SECONDARY   → 3 secondary grades only
 *  - null / undefined → all grades (superAdmin or unset)
 */
export function getAllowedGrades(stages?: string[] | null): readonly string[] {
    if (!stages || stages.length === 0) return ALL_GRADES;
    const grades: string[] = [];
    if (stages.includes('PRIMARY')) grades.push(...PRIMARY_GRADES);
    if (stages.includes('PREPARATORY')) grades.push(...PREPARATORY_GRADES);
    if (stages.includes('SECONDARY')) grades.push(...SECONDARY_GRADES);
    return grades;
}

/**
 * Helper to format stages for UI display.
 */
export function formatStages(stages?: string[] | null): string {
    if (!stages || stages.length === 0) return 'غير محدد';
    return stages.map(s => s === 'PRIMARY' ? 'ابتدائي' : s === 'PREPARATORY' ? 'إعدادي' : 'ثانوي').join(' - ');
}
