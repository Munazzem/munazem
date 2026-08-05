/**
 * tests/helpers/seed.helper.ts
 *
 * Extended seed factory functions — used across Phases 2-5.
 *
 * Every factory:
 *  - Creates a minimal valid document (only required fields filled)
 *  - Accepts an `overrides` object for per-test customization
 *  - Uses TEST_IDS from auth.helper.ts to ensure JWT/DB consistency
 *
 * Cleanup: afterEach in setup.env.ts wipes all collections automatically.
 * No manual cleanup is needed in individual tests.
 *
 * Re-exports the original db.helper.ts factories so tests only
 * need a single import from this file.
 */

import { Types } from 'mongoose';
import { TEST_IDS }     from './auth.helper.js';

// ── Models ──────────────────────────────────────────────────────────────────
import { UserModel }         from '../../src/database/models/user.model.js';
import { GroupModel }        from '../../src/database/models/group.model.js';
import { StudentModel }      from '../../src/database/models/student.model.js';
import { SessionModel }      from '../../src/database/models/session.model.js';
import { AttendanceModel }   from '../../src/database/models/attendance.model.js';
import { SubscriptionModel } from '../../src/database/models/subscription.model.js';
import { TransactionModel }  from '../../src/database/models/transaction.model.js';
import { NotebookModel }     from '../../src/database/models/notebook.model.js';
import { ExamModel }         from '../../src/database/models/exam.model.js';

// ── Enums ────────────────────────────────────────────────────────────────────
import {
    UserRole,
    TeacherStage,
    GradeLevel,
    SessionStatus,
    AttendanceStatus,
    SubscriptionStatus,
    SubscriptionPlan,
    TransactionType,
    TransactionCategory,
    QuestionType,
    ExamStatus,
    ExamSource,
} from '../../src/common/enums/enum.service.js';

// Re-exports from original db.helper.ts
export { seedTeacher, seedAssistant, seedGroup, seedStudent } from './db.helper.js';

// =============================================================================
// Users
// =============================================================================

/**
 * Creates a second teacher with a different ID — useful for tenant isolation tests.
 */
export async function seedOtherTeacher(overrides: Record<string, unknown> = {}) {
    return UserModel.create({
        name:     'معلم آخر',
        phone:    '01099999999',
        password: '$2b$10$placeholder.hashed.password.not.used.in.tests',
        role:     UserRole.teacher,
        stages:   [TeacherStage.PREPARATORY],
        isActive: true,
        assistantsAccessEnabled: true,
        ...overrides,
    });
}

// =============================================================================
// Sessions
// =============================================================================

/**
 * Creates a session linked to a group and the test teacher.
 *
 * @param groupId  - ObjectId from seedGroup()
 * @param overrides - Optional field overrides
 */
export async function seedSession(
    groupId: Types.ObjectId,
    overrides: Record<string, unknown> = {}
) {
    return SessionModel.create({
        groupId,
        teacherId:  TEST_IDS.teacher,
        date:       new Date(),
        startTime:  '10:00',
        status:     SessionStatus.SCHEDULED,
        ...overrides,
    });
}

// =============================================================================
// Attendance
// =============================================================================

/**
 * Creates an attendance record for a student in a session.
 *
 * @param sessionId  - ObjectId from seedSession()
 * @param studentId  - ObjectId from seedStudent()
 * @param overrides
 */
export async function seedAttendance(
    sessionId: Types.ObjectId,
    studentId: Types.ObjectId,
    overrides: Record<string, unknown> = {}
) {
    return AttendanceModel.create({
        sessionId,
        studentId,
        type:      'SESSION',
        status:    AttendanceStatus.PRESENT,
        scannedBy: TEST_IDS.teacher,
        scannedAt: new Date(),
        isGuest:   false,
        ...overrides,
    });
}

// =============================================================================
// Subscriptions
// =============================================================================

/**
 * Creates an ACTIVE subscription for the test teacher.
 *
 * @param overrides - Override planTier, status, endDate, etc.
 */
export async function seedSubscription(overrides: Record<string, unknown> = {}) {
    const now     = new Date();
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);

    return SubscriptionModel.create({
        teacherId:      TEST_IDS.teacher,
        planTier:       SubscriptionPlan.BASIC,
        durationMonths: 12,
        startDate:      now,
        endDate,
        amount:         900,
        status:         SubscriptionStatus.ACTIVE,
        studentsCount:  0,
        ...overrides,
    });
}

// =============================================================================
// Transactions
// =============================================================================

/**
 * Creates an income transaction for the test teacher.
 *
 * @param overrides - Override type, category, amounts, date, etc.
 */
export async function seedTransaction(overrides: Record<string, unknown> = {}) {
    return TransactionModel.create({
        teacherId:      TEST_IDS.teacher,
        createdBy:      TEST_IDS.teacher,
        type:           TransactionType.INCOME,
        category:       TransactionCategory.SUBSCRIPTION,
        originalAmount: 150,
        discountAmount: 0,
        paidAmount:     150,
        remainingAmount:0,
        date:           new Date(),
        ...overrides,
    });
}

// =============================================================================
// Notebooks
// =============================================================================

/**
 * Creates a notebook for the test teacher.
 *
 * @param overrides - Override name, gradeLevel, price, stock, etc.
 */
export async function seedNotebook(overrides: Record<string, unknown> = {}) {
    return NotebookModel.create({
        teacherId:     TEST_IDS.teacher,
        name:          'مذكرة تجريبية',
        gradeLevel:    GradeLevel.PREP_1,
        price:         30,
        stock:         10,
        reservedCount: 0,
        ...overrides,
    });
}

// =============================================================================
// Exams
// =============================================================================

/**
 * Creates a DRAFT exam for the test teacher.
 *
 * @param overrides - Override title, gradeLevel, questions, status, etc.
 */
export async function seedExam(overrides: Record<string, unknown> = {}) {
    return ExamModel.create({
        teacherId:    TEST_IDS.teacher,
        title:        'امتحان تجريبي',
        gradeLevel:   GradeLevel.PREP_1,
        groupIds:     [],
        date:         new Date(),
        totalMarks:   100,
        passingMarks: 50,
        status:       ExamStatus.DRAFT,
        source:       ExamSource.MANUAL,
        questions: [
            {
                type:          QuestionType.MCQ,
                text:          'ما عاصمة مصر؟',
                marks:         5,
                options:       ['القاهرة', 'الإسكندرية', 'أسوان'],
                correctAnswer: 'القاهرة',
            },
        ],
        ...overrides,
    });
}

// =============================================================================
// Composite Helpers
// =============================================================================

/**
 * Seeds the full attendance context: teacher -> group -> student -> session.
 * Returns all documents for direct use in tests.
 */
export async function seedAttendanceContext() {
    const { seedTeacher, seedGroup, seedStudent } = await import('./db.helper.js');

    const teacher = await seedTeacher();
    const group   = await seedGroup();
    const student = await seedStudent(group._id, {
        studentCode:  '1A',
        studentPhone: '01500000001',
        parentPhone:  '01600000001',
    });
    const session = await seedSession(group._id);

    return { teacher, group, student, session };
}
