/**
 * tests/helpers/auth.helper.ts
 *
 * يولّد JWTs للأدوار المختلفة لاستخدامها في الـ tests.
 *
 * يعكس بدقة شكل الـ IJwtPayload الموجود في:
 * src/types/auth.types.ts
 *
 * ويستخدم نفس الـ JWT_SECRET المضبوط في tests/setup.ts
 */

import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { UserRole } from '../../src/common/enums/enum.service.js';

// ─── JWT Secret ───────────────────────────────────────────────────────────────
// يجب أن يطابق ما هو مضبوط في tests/setup.ts
const JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!';

// ─── IJwtPayload Shape ────────────────────────────────────────────────────────
// مطابق لـ src/types/auth.types.ts
interface TestJwtPayload {
    userId:    string;
    role:      UserRole;
    teacherId: string | null;
    isActive:  boolean;
}

// ─── Pre-built ObjectIds ──────────────────────────────────────────────────────
// IDs ثابتة ومتسقة عبر كل الـ tests
export const TEST_IDS = {
    teacher:    new Types.ObjectId(),
    assistant:  new Types.ObjectId(),
    superAdmin: new Types.ObjectId(),
} as const;

// ─── Token Generators ─────────────────────────────────────────────────────────

/**
 * يولّد JWT لـ Teacher
 * المعلم مش عنده teacherId (هو نفسه المرجع الأصلي)
 */
export function makeTeacherToken(overrides?: Partial<TestJwtPayload>): string {
    const payload: TestJwtPayload = {
        userId:    TEST_IDS.teacher.toString(),
        role:      UserRole.teacher,
        teacherId: null,
        isActive:  true,
        ...overrides,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * يولّد JWT لـ Assistant
 * الـ assistant بيتبع للـ teacher عن طريق teacherId
 */
export function makeAssistantToken(overrides?: Partial<TestJwtPayload>): string {
    const payload: TestJwtPayload = {
        userId:    TEST_IDS.assistant.toString(),
        role:      UserRole.assistant,
        teacherId: TEST_IDS.teacher.toString(), // تابع لنفس الـ teacher
        isActive:  true,
        ...overrides,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * يولّد JWT لـ SuperAdmin
 */
export function makeSuperAdminToken(overrides?: Partial<TestJwtPayload>): string {
    const payload: TestJwtPayload = {
        userId:    TEST_IDS.superAdmin.toString(),
        role:      UserRole.superAdmin,
        teacherId: null,
        isActive:  true,
        ...overrides,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

// ─── Convenience Helper ───────────────────────────────────────────────────────

/**
 * يرجع Authorization header جاهز للاستخدام في supertest
 * مثال: request.set('Authorization', bearerHeader(makeTeacherToken()))
 */
export const bearerHeader = (token: string): string => `Bearer ${token}`;
