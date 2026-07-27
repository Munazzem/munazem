/**
 * tests/helpers/db.helper.ts
 *
 * Factory functions لإنشاء بيانات تجريبية في الـ DB.
 * كل function بتقبل overrides عشان تقدر تخصص البيانات حسب الـ test.
 *
 * تستخدم TEST_IDS من auth.helper.ts لضمان التوافق مع الـ JWTs.
 */

import { Types } from 'mongoose';
import { UserModel }    from '../../src/database/models/user.model.js';
import { GroupModel }   from '../../src/database/models/group.model.js';
import { StudentModel } from '../../src/database/models/student.model.js';
import {
    GradeLevel,
    UserRole,
    TeacherStage,
} from '../../src/common/enums/enum.service.js';
import { TEST_IDS } from './auth.helper.js';

// ─── Seed Teacher ─────────────────────────────────────────────────────────────
/**
 * ينشئ معلم في الـ DB بنفس الـ ID المستخدم في teacherToken()
 * مطلوب لأن معظم الـ services بتتحقق من وجود الـ teacherId في الـ DB
 */
export async function seedTeacher(overrides: Record<string, unknown> = {}) {
    return UserModel.create({
        _id:      TEST_IDS.teacher,
        name:     'أحمد المعلم التجريبي',
        phone:    '01000000001',
        password: '$2b$10$placeholder.hashed.password.not.used.in.tests',
        role:     UserRole.teacher,
        stages:   [TeacherStage.PREPARATORY],
        isActive: true,
        assistantsAccessEnabled: true,
        ...overrides,
    });
}

// ─── Seed Assistant ───────────────────────────────────────────────────────────
/**
 * ينشئ assistant مرتبط بالـ teacher التجريبي
 */
export async function seedAssistant(overrides: Record<string, unknown> = {}) {
    return UserModel.create({
        _id:       TEST_IDS.assistant,
        name:      'مساعد تجريبي',
        phone:     '01100000001',
        password:  '$2b$10$placeholder.hashed.password.not.used.in.tests',
        role:      UserRole.assistant,
        teacherId: TEST_IDS.teacher,
        isActive:  true,
        ...overrides,
    });
}

// ─── Seed Group ───────────────────────────────────────────────────────────────
/**
 * ينشئ مجموعة تابعة للـ teacher التجريبي
 * الـ gradeLevel الافتراضي هو PREP_1 (الصف الأول الإعدادي)
 */
export async function seedGroup(overrides: Record<string, unknown> = {}) {
    return GroupModel.create({
        name:       'مجموعة تجريبية أ',
        gradeLevel: GradeLevel.PREP_1,
        schedule:   [
            { day: 'الأحد',   time: '10:00' },
            { day: 'الثلاثاء', time: '10:00' },
        ],
        capacity:   50,
        teacherId:  TEST_IDS.teacher,
        isActive:   true,
        ...overrides,
    });
}

// ─── Seed Student ─────────────────────────────────────────────────────────────
/**
 * ينشئ طالب في مجموعة معينة
 * @param groupId - الـ _id للمجموعة (من seedGroup())
 */
export async function seedStudent(
    groupId: Types.ObjectId,
    overrides: Record<string, unknown> = {}
) {
    return StudentModel.create({
        studentName:  'محمد أحمد علي',
        parentName:   'أحمد علي',
        studentPhone: '01500000001',
        parentPhone:  '01600000001',
        gradeLevel:   GradeLevel.PREP_1,
        studentCode:  '1A',
        barcode:      crypto.randomUUID(),
        groupId,
        teacherId:    TEST_IDS.teacher,
        isActive:     true,
        remainingSessions: 0,
        ...overrides,
    });
}
