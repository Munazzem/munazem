/**
 * Re-exports from the canonical grade constants file.
 * Kept for backward compatibility — import directly from
 * '@/lib/constants/grade.constants' in new code.
 */
export {
    PREPARATORY_GRADES,
    SECONDARY_GRADES,
    ALL_GRADES,
    getAllowedGrades,
    type GradeLevel,
} from '@/lib/constants/grade.constants';

// Legacy alias
export type { GradeLevel as GradeLevelString } from '@/lib/constants/grade.constants';

/** @deprecated Use ALL_GRADES from '@/lib/constants/grade.constants' */
export { ALL_GRADES as ALL_GRADE_LEVELS } from '@/lib/constants/grade.constants';
