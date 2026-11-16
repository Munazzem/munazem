import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { getTestApp } from '../helpers/app.helper.js';
import { makeSuperAdminToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedSuperAdmin } from '../helpers/db.helper.js';
import { TransactionModel } from '../../src/database/models/transaction.model.js';
import { CenterSessionModel } from '../../src/database/models/center-session.model.js';
import { CenterEnrollmentModel } from '../../src/database/models/center-enrollment.model.js';
import { UserRole, CenterSupervisorType, TransactionCategory, TransactionType, GradeLevel, CenterGroupType, CenterEnrollmentType } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

const JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!';

function makeToken(payload: Record<string, any>): string {
    return jwt.sign({ isActive: true, ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Center Role Permissions, Branch Fallback, and Cairo Financial Timestamps', () => {
    it('falls back to main branch when centerOwner sends stale or invalid x-branch-id', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر الأمل',
                ownerName: 'أحمد Owner',
                phone: '01099887766',
                password: 'password123',
            });

        expect(onboardRes.status).toBe(201);
        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeToken({ userId: ownerId, role: UserRole.centerOwner, centerId });

        // Stale non-existent ObjectId in x-branch-id cookie
        const staleObjRes = await app
            .get('/centers/teachers')
            .set('Authorization', bearerHeader(ownerToken))
            .set('x-branch-id', new Types.ObjectId().toString());
        expect(staleObjRes.status).toBe(200);

        // Malformed string in x-branch-id
        const malformedRes = await app
            .get('/centers/financials/summary')
            .set('Authorization', bearerHeader(ownerToken))
            .set('x-branch-id', 'invalid-branch-id');
        expect(malformedRes.status).toBe(200);
    });

    it('enforces supervisor permissions cleanly and hydrates /auth/me center branding', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر النور',
                ownerName: 'أحمد Owner 2',
                phone: '01099887755',
                password: 'password123',
            });

        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeToken({ userId: ownerId, role: UserRole.centerOwner, centerId });

        // Create attendance-only supervisor (without financials)
        const supRes = await app
            .post('/centers/supervisors')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                name: 'مشرف الحضور',
                phone: '01088776655',
                password: 'password123',
                supervisorType: CenterSupervisorType.ATTENDANCE,
            });
        expect(supRes.status).toBe(201);

        const supervisorId = supRes.body.data._id;
        const supToken = makeToken({ userId: supervisorId, role: UserRole.centerSupervisor, centerId });

        // /auth/me hydrates centerName for centerSupervisor
        const meRes = await app
            .get('/auth/me')
            .set('Authorization', bearerHeader(supToken));
        expect(meRes.status).toBe(200);
        expect(meRes.body.data.centerName).toBe('سنتر النور');

        // Permitted attendance check-ins works
        const checkInRes = await app
            .get('/centers/attendance/check-ins')
            .set('Authorization', bearerHeader(supToken));
        expect(checkInRes.status).toBe(200);

        // Owner-only supervisors endpoint returns 403
        const forbSupRes = await app
            .get('/centers/supervisors')
            .set('Authorization', bearerHeader(supToken));
        expect(forbSupRes.status).toBe(403);
    });

    it('preserves real timestamps on payment creation/update and filters daily tally by Cairo bounds', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر التوقيت',
                ownerName: 'أحمد Owner 3',
                phone: '01077665544',
                password: 'password123',
            });

        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeToken({ userId: ownerId, role: UserRole.centerOwner, centerId });

        const stRes = await app
            .post('/centers/students')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentName: 'كريم محمد',
                parentName: 'محمد',
                studentPhone: '01011223344',
                parentPhone: '01055667788',
                gradeLevel: GradeLevel.SEC_1,
            });
        expect(stRes.status).toBe(201);
        const studentId = stRes.body.data._id;

        // 1. Recording payment with ISO timestamp keeps exact timestamp
        const isoInstant = '2026-08-15T22:30:00.000Z'; // 2026-08-16 01:30 AM Cairo (summer UTC+3)
        const payRes = await app
            .post('/centers/financials/payment')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentId,
                category: TransactionCategory.CENTER_PACKAGE,
                originalAmount: 500,
                discountAmount: 0,
                paidAmount: 500,
                remainingAmount: 0,
                date: isoInstant,
            });
        expect(payRes.status).toBe(201);
        const txId = payRes.body.data._id;

        // In summer (UTC+3), 22:30 UTC on Aug 15 is 01:30 AM on Aug 16 in Cairo!
        const tallyAug15 = await app
            .get('/centers/financials/daily-tally?date=2026-08-15')
            .set('Authorization', bearerHeader(ownerToken));
        expect(tallyAug15.status).toBe(200);
        expect(tallyAug15.body.data.transactionCount).toBe(0);

        const tallyAug16 = await app
            .get('/centers/financials/daily-tally?date=2026-08-16')
            .set('Authorization', bearerHeader(ownerToken));
        expect(tallyAug16.status).toBe(200);
        expect(tallyAug16.body.data.transactionCount).toBe(1);

        // 2. Recording payment with date-only string does NOT collapse to 00:00:00.000Z
        const today = new Date().toISOString().split('T')[0];
        const dateOnlyPay = await app
            .post('/centers/financials/payment')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentId,
                category: TransactionCategory.CENTER_PACKAGE,
                originalAmount: 200,
                paidAmount: 200,
                date: today,
            });
        expect(dateOnlyPay.status).toBe(201);
        const savedDate = new Date(dateOnlyPay.body.data.date);
        expect(savedDate.getUTCHours() === 0 && savedDate.getUTCMinutes() === 0 && savedDate.getUTCSeconds() === 0).toBe(false);

        // 3. Updating transaction with same Cairo date-only string keeps original timestamp
        const updateRes = await app
            .patch(`/centers/financials/transactions/${txId}`)
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                paidAmount: 450,
                date: '2026-08-16',
            });
        expect(updateRes.status).toBe(200);
        expect(new Date(updateRes.body.data.date).toISOString()).toBe(isoInstant);

        const updatedDoc = await TransactionModel.findById(txId).lean();
        expect(updatedDoc?.paidAmount).toBe(450);
    });

    it('supports 1-char Arabic normalized search and Arabic alphabetical collation sort', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر البحث والترتيب',
                ownerName: 'أدمن',
                phone: '01066554433',
                password: 'password123',
            });
        expect(onboardRes.status).toBe(201);
        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeToken({ userId: ownerId, role: UserRole.centerOwner, centerId });

        const names = ['يوسف طارق', 'چني محمد', 'أحمد محمود', 'ايمن سعيد', 'زياد كريم'];
        for (const studentName of names) {
            const res = await app
                .post('/centers/students')
                .set('Authorization', bearerHeader(ownerToken))
                .send({
                    studentName,
                    parentName: 'ولي أمر',
                    gradeLevel: GradeLevel.PREP_1,
                });
            expect(res.status).toBe(201);
        }

        // 1-char normalized Alef search
        const alefRes = await app
            .get('/centers/students?search=' + encodeURIComponent('ا'))
            .set('Authorization', bearerHeader(ownerToken));
        expect(alefRes.status).toBe(200);
        const alefNames = alefRes.body.data.data.map((s: any) => s.studentName);
        expect(alefNames).toContain('أحمد محمود');
        expect(alefNames).toContain('ايمن سعيد');

        // Normalized Gaf / Ya / Alef-Maqsura search
        const gafRes = await app
            .get('/centers/students?search=' + encodeURIComponent('جنى'))
            .set('Authorization', bearerHeader(ownerToken));
        expect(gafRes.status).toBe(200);
        expect(gafRes.body.data.data.map((s: any) => s.studentName)).toEqual(['چني محمد']);

        // Default directory listing is sorted in Arabic alphabetical order (ج/چ before ز before ي)
        const listRes = await app
            .get('/centers/students?gradeLevel=' + encodeURIComponent(GradeLevel.PREP_1))
            .set('Authorization', bearerHeader(ownerToken));
        expect(listRes.status).toBe(200);
        const orderedNames = listRes.body.data.data.map((s: any) => s.studentName);
        expect(orderedNames).toEqual(['أحمد محمود', 'ايمن سعيد', 'چني محمد', 'زياد كريم', 'يوسف طارق']);
    });

    it('freezes COMPLETED session snapshots, excludes un-enrolled students, and protects packageGroups on updatePackage', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر الحصص والباكيدج',
                ownerName: 'أدمن الحصص',
                phone: '01055443322',
                password: 'password123',
            });
        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeToken({ userId: ownerId, role: UserRole.centerOwner, centerId });

        // Create two teachers for the same subject/grade
        const t1Res = await app.post('/centers/teachers').set('Authorization', bearerHeader(ownerToken)).send({
            name: 'أ/ مصطفى',
            subject: 'دراسات',
        });
        const t2Res = await app.post('/centers/teachers').set('Authorization', bearerHeader(ownerToken)).send({
            name: 'أ/ محمود',
            subject: 'دراسات',
        });
        expect(t1Res.status).toBe(201);
        expect(t2Res.status).toBe(201);

        const g1Res = await app.post('/centers/groups').set('Authorization', bearerHeader(ownerToken)).send({
            name: 'دراسات 1',
            gradeLevel: GradeLevel.PREP_1,
            centerTeacherId: t1Res.body.data._id,
            groupType: CenterGroupType.PACKAGE,
            schedule: [{ day: 'السبت', time: '14:00' }],
        });
        const g2Res = await app.post('/centers/groups').set('Authorization', bearerHeader(ownerToken)).send({
            name: 'دراسات 2',
            gradeLevel: GradeLevel.PREP_1,
            centerTeacherId: t2Res.body.data._id,
            groupType: CenterGroupType.PACKAGE,
            schedule: [{ day: 'الأحد', time: '16:00' }],
        });
        expect(g1Res.status).toBe(201);
        expect(g2Res.status).toBe(201);
        const g1Id = g1Res.body.data._id;
        const g2Id = g2Res.body.data._id;

        const pkgRes = await app.post('/centers/packages').set('Authorization', bearerHeader(ownerToken)).send({
            name: 'باكيدج أولى إعدادي',
            gradeLevel: GradeLevel.PREP_1,
            monthlyPrice: 600,
            teachers: [
                { teacherId: t1Res.body.data._id, subject: 'دراسات', groupId: g1Id },
                { teacherId: t2Res.body.data._id, subject: 'دراسات', groupId: g2Id },
            ],
        });
        expect(pkgRes.status).toBe(201);
        const pkgId = pkgRes.body.data._id;

        // Create student A (enrolled ONLY in group 1) and student U (no enrollment at all)
        const stARes = await app.post('/centers/students').set('Authorization', bearerHeader(ownerToken)).send({
            studentName: 'سارة أحمد',
            parentName: 'أحمد',
            gradeLevel: GradeLevel.PREP_1,
        });
        const stURes = await app.post('/centers/students').set('Authorization', bearerHeader(ownerToken)).send({
            studentName: 'غير مشترك',
            parentName: 'ولي أمر',
            gradeLevel: GradeLevel.PREP_1,
        });
        const stAId = stARes.body.data._id;
        const stUId = stURes.body.data._id;

        const enrARes = await app.post('/centers/enrollments').set('Authorization', bearerHeader(ownerToken)).send({
            studentId: stAId,
            type: CenterEnrollmentType.PACKAGE,
            packageId: pkgId,
            packageGroups: [g1Id],
        });
        expect(enrARes.status).toBe(201);

        // Complete a session for group 1 on today's Cairo date (when stA already existed)
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const map: Record<string, string> = {};
        for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
        const dateStr = `${map.year}-${map.month}-${map.day}`;

        await CenterSessionModel.create({
            centerId: new Types.ObjectId(centerId),
            groupId: new Types.ObjectId(g1Id),
            centerTeacherId: new Types.ObjectId(t1Res.body.data._id),
            gradeLevel: GradeLevel.PREP_1,
            subject: 'دراسات',
            sessionDate: new Date(`${dateStr}T00:00:00.000Z`),
            scheduledDay: 'السبت',
            scheduledTime: '14:00',
            status: 'SCHEDULED',
        });

        const completeRes = await app
            .post(`/centers/sessions/${g1Id}/complete?date=${dateStr}`)
            .set('Authorization', bearerHeader(ownerToken))
            .send({});
        expect(completeRes.status).toBe(200);

        // Older uncompleted session before students existed must also exclude stA and un-enrolled stU
        const pastDetail = await app
            .get(`/centers/sessions/${g1Id}?date=2026-01-10`)
            .set('Authorization', bearerHeader(ownerToken));
        expect(pastDetail.status).toBe(200);
        expect(pastDetail.body.data.students).toEqual([]);

        // Un-enrolled student U must NEVER be pulled into group 1 or group 2
        const g2Detail = await app
            .get(`/centers/sessions/${g2Id}?date=${dateStr}`)
            .set('Authorization', bearerHeader(ownerToken));
        expect(g2Detail.status).toBe(200);
        expect(g2Detail.body.data.students.map((s: any) => String(s._id))).not.toContain(String(stUId));
        expect(g2Detail.body.data.students.map((s: any) => String(s._id))).not.toContain(String(stAId));

        // Add student B AFTER session 1 was already completed, and enroll in group 1
        const stBRes = await app.post('/centers/students').set('Authorization', bearerHeader(ownerToken)).send({
            studentName: 'رنا جديد',
            parentName: 'جديد',
            gradeLevel: GradeLevel.PREP_1,
        });
        const stBId = stBRes.body.data._id;
        await app.post('/centers/enrollments').set('Authorization', bearerHeader(ownerToken)).send({
            studentId: stBId,
            type: CenterEnrollmentType.PACKAGE,
            packageId: pkgId,
            packageGroups: [g1Id],
        });

        // Completed session 1 snapshot remains strictly frozen (only student A, never student B)
        const g1CompletedDetail = await app
            .get(`/centers/sessions/${g1Id}?date=${dateStr}`)
            .set('Authorization', bearerHeader(ownerToken));
        expect(g1CompletedDetail.status).toBe(200);
        expect(g1CompletedDetail.body.data.students.map((s: any) => String(s._id))).toEqual([String(stAId)]);

        // Updating package must NOT overwrite student A's selected packageGroups
        const pkgUpdateRes = await app
            .put(`/centers/packages/${pkgId}`)
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                monthlyPrice: 650,
                teachers: [
                    { teacherId: t1Res.body.data._id, subject: 'دراسات', groupId: g1Id },
                    { teacherId: t2Res.body.data._id, subject: 'دراسات', groupId: g2Id },
                ],
            });
        expect(pkgUpdateRes.status).toBe(200);
        const enrADoc = await CenterEnrollmentModel.findOne({ studentId: stAId }).lean();
        expect((enrADoc?.packageGroups || []).map(String)).toEqual([String(g1Id)]);
    });
});
