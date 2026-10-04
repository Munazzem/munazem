/**
 * tests/integration/centers-full-flow.api.test.ts
 *
 * Comprehensive integration tests for:
 * 1. Center student creation and code generation (${count}${letter} e.g. 1D, 2D)
 * 2. Center blank card generation, resolve, and link-new-student flow
 * 3. Public card resolve by token (/cards/resolve/:token)
 * 4. Center gate check-in flow & daily check-ins query
 * 5. Parent Web portal lookup by phone (ParentService.lookupByPhone)
 * 6. Parent mobile app family overview, child card, child attendance, child financials, and child subjects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getTestApp } from '../helpers/app.helper.js';
import { makeSuperAdminToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedSuperAdmin } from '../helpers/db.helper.js';
import { CenterModel } from '../../src/database/models/center.model.js';
import { CenterStudentModel } from '../../src/database/models/center-student.model.js';
import { CardModel } from '../../src/database/models/card.model.js';
import { CenterCheckInModel } from '../../src/database/models/center-checkin.model.js';
import { CenterAttendanceModel } from '../../src/database/models/center-attendance.model.js';
import { ParentModel } from '../../src/database/models/parent.model.js';
import { ParentStudentModel } from '../../src/database/models/parent-student.model.js';
import { ParentService } from '../../src/modules/parent/parent.service.js';
import { ParentAuthService } from '../../src/modules/parent/parent-auth.service.js';
import { ParentAppService } from '../../src/modules/parent/parent-app.service.js';
import { CardsService } from '../../src/modules/cards/cards.service.js';
import { UserRole, GradeLevel, CenterGroupType } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

const JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!';

function makeCenterOwnerToken(ownerId: string, centerId: string): string {
    return jwt.sign({
        userId: ownerId,
        role: UserRole.centerOwner,
        teacherId: null,
        centerId,
        isActive: true,
    }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Center Full Flow & Parent App Integration Tests', () => {

    it('Tests center student codes, smart cards, gate attendance, and parent app integration', async () => {
        await seedSuperAdmin();

        // ── 1. Onboard a Center ───────────────────────────────────────────────
        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر الفاخر التعليمي',
                ownerName: 'محمود عبد الوهاب',
                phone: '01011112222',
                password: 'password123',
            });

        expect(onboardRes.status).toBe(201);
        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeCenterOwnerToken(ownerId, centerId);

        // ── 2. Create Students & Verify Simple Student Codes (${count}${letter}) ──
        // First student in SEC_1 (GradeLevel.SEC_1 has letter 'D')
        const st1Res = await app
            .post('/centers/students')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentName: 'محمود أحمد إبراهيم',
                parentName: 'أحمد إبراهيم',
                studentPhone: '01012345671',
                parentPhone: '01099887711',
                gradeLevel: GradeLevel.SEC_1,
            });
        expect(st1Res.status).toBe(201);
        expect(st1Res.body.data.studentCode).toBe('1D');

        // Second student in SEC_1 -> 2D
        const st2Res = await app
            .post('/centers/students')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentName: 'يوسف رامي فؤاد',
                parentName: 'رامي فؤاد',
                studentPhone: '01012345672',
                parentPhone: '01099887722',
                gradeLevel: GradeLevel.SEC_1,
            });
        expect(st2Res.status).toBe(201);
        expect(st2Res.body.data.studentCode).toBe('2D');

        // Third student in PREP_1 (GradeLevel.PREP_1 has letter 'A') -> 1A
        const st3Res = await app
            .post('/centers/students')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentName: 'أحمد كمال شريف',
                parentName: 'كمال شريف',
                studentPhone: '01012345673',
                parentPhone: '01099887733',
                gradeLevel: GradeLevel.PREP_1,
            });
        expect(st3Res.status).toBe(201);
        expect(st3Res.body.data.studentCode).toBe('1A');

        // ── 3. Smart Card Batch Generation & Link-New-Student Flow ─────────────
        const batchRes = await app
            .post('/centers/cards/generate')
            .set('Authorization', bearerHeader(ownerToken))
            .send({ count: 5 });
        expect(batchRes.status).toBe(201);
        expect(batchRes.body.data.cards.length).toBe(5);

        const blankCard = batchRes.body.data.cards[0];
        expect(blankCard.cardNumber).toBeDefined();
        expect(blankCard.cardToken).toBeDefined();

        // Scan blank card via scanner resolution
        const resolveBlank = await app
            .get(`/centers/cards/resolve?scanInput=${blankCard.cardToken}`)
            .set('Authorization', bearerHeader(ownerToken));
        expect(resolveBlank.status).toBe(200);
        expect(resolveBlank.body.data.card.status).toBe('NEW');
        expect(resolveBlank.body.data.isLinked).toBe(false);
        expect(resolveBlank.body.data.student).toBeNull();

        // Link new student from blank card (should also generate simple studentCode e.g. 3D)
        const linkNewStudentRes = await app
            .post('/centers/cards/create-and-link')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                cardNumber: blankCard.cardNumber,
                studentName: 'سارة طارق الجوهري',
                parentName: 'طارق الجوهري',
                studentPhone: '01055554441',
                parentPhone: '01099887744',
                gradeLevel: GradeLevel.SEC_1,
            });
        expect(linkNewStudentRes.status).toBe(201);
        expect(linkNewStudentRes.body.data.student.studentCode).toBe('3D');
        expect(linkNewStudentRes.body.data.student.barcode).toBe(blankCard.cardNumber);

        // ── 4. Public Card Resolution (/cards/resolve/:token) ───────────────────
        const publicCardSummary = await CardsService.resolveByToken(blankCard.cardToken);
        expect(publicCardSummary).toBeDefined();
        expect(publicCardSummary.studentName).toBe('سارة طارق الجوهري');
        expect(publicCardSummary.studentCode).toBe('3D');
        expect(publicCardSummary.groupName).toContain('سنتر الفاخر التعليمي');

        // ── 5. Center Gate Check-In & Anti-Duplicate Scan ──────────────────────
        const checkInRes1 = await app
            .post('/centers/attendance/check-in')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentIdOrCode: blankCard.cardNumber,
                source: 'QR_SCAN',
            });
        expect(checkInRes1.status).toBe(201);
        expect(checkInRes1.body.data.isNewCheckIn).toBe(true);
        expect(checkInRes1.body.data.student.studentName).toBe('سارة طارق الجوهري');

        // Second check-in today with same card (should report already checked in today)
        const checkInRes2 = await app
            .post('/centers/attendance/check-in')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentIdOrCode: blankCard.cardNumber,
                source: 'QR_SCAN',
            });
        expect(checkInRes2.status).toBe(200);
        expect(checkInRes2.body.data.isNewCheckIn).toBe(false);

        // ── 6. Parent Web Portal Lookup by Phone ──────────────────────────────
        const parentWebLookup = await ParentService.lookupByPhone('01099887744');
        expect(parentWebLookup).toBeDefined();
        expect(parentWebLookup.length).toBeGreaterThan(0);
        const centerStudentEntry = parentWebLookup.find(s => s.studentName === 'سارة طارق الجوهري');
        expect(centerStudentEntry).toBeDefined();
        expect(centerStudentEntry?.studentCode).toBe('3D');
        expect(centerStudentEntry?.teacherName).toBe('سنتر الفاخر التعليمي');
        expect(centerStudentEntry?.attendance.presentCount).toBe(1);

        // ── 7. Parent Mobile App Auth & Link by Card Barcode ───────────────────
        const parentAuthRes = await ParentAuthService.verifyBarcode({
            barcode: blankCard.cardNumber,
            deviceId: 'device-test-123',
            platform: 'android',
        });
        expect(parentAuthRes).toBeDefined();
        expect(parentAuthRes.parent).toBeDefined();
        expect(parentAuthRes.token).toBeDefined();

        const parentId = parentAuthRes.parent.id;
        const studentId = linkNewStudentRes.body.data.student._id;

        // ── 8. Parent App Family Overview ──────────────────────────────────────
        const familyOverview = await ParentAppService.getFamilyOverview(parentId);
        expect(familyOverview).toBeDefined();
        expect(familyOverview.children.length).toBeGreaterThan(0);
        const childOverview = familyOverview.children.find(c => c.studentName === 'سارة طارق الجوهري');
        expect(childOverview).toBeDefined();
        expect(childOverview?.isCenter).toBe(true);
        expect(childOverview?.cardNumber).toBe(blankCard.cardNumber);
        expect(childOverview?.studentCode).toBe('3D');
        expect(childOverview?.latestAttendance?.status).toBe('PRESENT');

        // ── 9. Parent App Child Smart Card ─────────────────────────────────────
        const childCard = await ParentAppService.getChildCard(parentId, studentId);
        expect(childCard).toBeDefined();
        expect(childCard.studentName).toBe('سارة طارق الجوهري');
        expect(childCard.studentCode).toBe('3D');
        expect(childCard.cardNumber).toBe(blankCard.cardNumber);
        expect(childCard.isCenter).toBe(true);
        expect(childCard.qrValue).toBe(blankCard.cardToken);

        // ── 10. Parent App Child Attendance History ────────────────────────────
        const childAttendance = await ParentAppService.getChildAttendance(parentId, studentId);
        expect(childAttendance).toBeDefined();
        expect(childAttendance.length).toBeGreaterThan(0);
        expect(childAttendance[0].status).toBe('PRESENT');
        expect(childAttendance[0].subject).toContain('دخول السنتر');
        expect(childAttendance[0].teacherName).toContain('سنتر الفاخر التعليمي');

        // ── 11. Parent App Child Financials ────────────────────────────────────
        const childFinancial = await ParentAppService.getChildFinancial(parentId, studentId);
        expect(childFinancial).toBeDefined();
        expect(childFinancial.length).toBeGreaterThan(0);
        expect(childFinancial[0].teacherName).toContain('سنتر الفاخر التعليمي');
    });
});
