/**
 * Grade level constants — single source of truth.
 *
 * Replaces both:
 *  - `GradeLevel` / `ALL_GRADES` in `payment.types.ts`
 *  - `GradeLevelString` / `ALL_GRADE_LEVELS` in `lib/utils/grades.ts`
 */

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

export const ALL_GRADES = [...PREPARATORY_GRADES, ...SECONDARY_GRADES] as const;

/** Union type derived from the constant — the single GradeLevel type. */
export type GradeLevel = typeof ALL_GRADES[number];

/**
 * Returns the allowed grade levels based on teacher's stage.
 *  - PREPARATORY → 3 prep grades only
 *  - SECONDARY   → 3 secondary grades only
 *  - null / undefined → all 6 grades (superAdmin or unset)
 */
export function getAllowedGrades(stage?: string | null): readonly string[] {
    if (stage === 'PREPARATORY') return PREPARATORY_GRADES;
    if (stage === 'SECONDARY')   return SECONDARY_GRADES;
    return ALL_GRADES;
}
