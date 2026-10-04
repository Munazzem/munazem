/**
 * tests/integration/centers-checkin.api.test.ts
 *
 * Integration tests for Center Daily Entrance Check-In and Reception Flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { getTestApp } from '../helpers/app.helper.js';
import { makeSuperAdminToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedSuperAdmin } from '../helpers/db.helper.js';
import { UserModel } from '../../src/database/models/user.model.js';
import { CenterCheckInModel } from '../../src/database/models/center-checkin.model.js';
import { CenterAttendanceModel } from '../../src/database/models/center-attendance.model.js';
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

describe('Center Gate Check-In & Daily Attendance Workflow', () => {

    it('Complete reception check-in flow: scan student, detect today classes, update attendance, list daily check-ins', async () => {
        await seedSuperAdmin();

        // 1. Onboard a Center
        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر النخبة التعليمي',
                ownerName: 'محمد سعيد',
                phone: '01011223344',
                password: 'password123',
            });

        expect(onboardRes.status).toBe(201);
        const centerId = onboardRes.body.data.center._id;
        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeCenterOwnerToken(ownerId, centerId);

        // 2. Create a Teacher
        const teacherRes = await app
            .post('/centers/teachers')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                name: 'أ/ حسام خليل',
                subject: 'فيزياء',
            });
        expect(teacherRes.status).toBe(201);
        const teacherId = teacherRes.body.data._id;

        // Determine today's day of week in Arabic
        const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const todayArabicDay = ARABIC_DAYS[new Date().getDay()];

        // 3. Create a Group with today's schedule
        const groupRes = await app
            .post('/centers/groups')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                name: 'مجموعة فيزياء 3ث (الأوائل)',
                centerTeacherId: teacherId,
                gradeLevel: GradeLevel.SEC_3,
                groupType: CenterGroupType.PACKAGE,
                schedule: [
                    { day: todayArabicDay, time: '02:00 م' },
                ],
                capacity: 40,
            });
        expect(groupRes.status).toBe(201);
        const groupId = groupRes.body.data._id;

        // 4. Create a Center Student
        const studentRes = await app
            .post('/centers/students')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentName: 'عمر خالد حسن',
                parentName: 'خالد حسن',
                studentPhone: '01099881122',
                parentPhone: '01099881133',
                gradeLevel: GradeLevel.SEC_3,
                barcode: 'CARD-OMAR-777',
            });
        expect(studentRes.status).toBe(201);
        const student = studentRes.body.data;
        expect(student.studentCode).toBeDefined();

        // 5. Enroll Student into the Group
        const enrollRes = await app
            .post('/centers/enrollments')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentId: student._id,
                type: 'PACKAGE',
                packageGroups: [groupId],
            });
        expect(enrollRes.status).toBe(201);

        // 6. Test Gate Check-In by barcode
        const checkInRes = await app
            .post('/centers/attendance/check-in')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentIdOrCode: 'CARD-OMAR-777',
                source: 'BARCODE',
            });

        expect(checkInRes.status).toBe(201);
        expect(checkInRes.body.data.isNewCheckIn).toBe(true);
        expect(checkInRes.body.data.student.studentName).toBe('عمر خالد حسن');
        expect(checkInRes.body.data.scheduledTodayGroups.length).toBe(1);
        expect(checkInRes.body.data.scheduledTodayGroups[0]._id).toBe(groupId);

        // 7. Verify CheckIn record exists in DB
        const checkInDoc = await CenterCheckInModel.findOne({ centerId, studentId: student._id }).lean();
        expect(checkInDoc).not.toBeNull();
        expect(checkInDoc?.source).toBe('BARCODE');

        // 8. Re-scanning same student returns duplicate check-in status 200
        const duplicateRes = await app
            .post('/centers/attendance/check-in')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentIdOrCode: student.studentCode, // scan by code
            });

        expect(duplicateRes.status).toBe(200);
        expect(duplicateRes.body.data.isNewCheckIn).toBe(false);

        // 9. Receptionist specifies that student attended today's group
        const updateGroupsRes = await app
            .put('/centers/attendance/check-in/groups')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentId: student._id,
                groupIds: [groupId],
            });

        expect(updateGroupsRes.status).toBe(200);

        // Verify CenterAttendanceModel has the record
        const attDoc = await CenterAttendanceModel.findOne({
            centerId,
            studentId: student._id,
            groupId,
        }).lean();

        expect(attDoc).not.toBeNull();
        expect(attDoc?.status).toBe('PRESENT');
        expect(attDoc?.source).toBe('GATE_CHECKIN');

        // 10. Fetch Daily Check-Ins Feed
        const dailyRes = await app
            .get('/centers/attendance/check-ins')
            .set('Authorization', bearerHeader(ownerToken));

        expect(dailyRes.status).toBe(200);
        expect(dailyRes.body.data.total).toBe(1);
        expect(dailyRes.body.data.stats.totalCheckedIn).toBe(1);
        expect(dailyRes.body.data.stats.totalWithAttendedClasses).toBe(1);
        expect(dailyRes.body.data.checkIns[0].studentId.studentName).toBe('عمر خالد حسن');
    });

    it('Returns 404 for unknown barcode or code', async () => {
        await seedSuperAdmin();

        const onboardRes = await app
            .post('/centers/onboard')
            .set('Authorization', bearerHeader(makeSuperAdminToken()))
            .send({
                centerName: 'سنتر تجريبي',
                ownerName: 'علي كمال',
                phone: '01055554444',
                password: 'password123',
            });

        const ownerId = onboardRes.body.data.owner.id || onboardRes.body.data.owner._id;
        const ownerToken = makeCenterOwnerToken(ownerId, onboardRes.body.data.center._id);

        const res = await app
            .post('/centers/attendance/check-in')
            .set('Authorization', bearerHeader(ownerToken))
            .send({
                studentIdOrCode: 'NON-EXISTENT-CODE',
            });

        expect(res.status).toBe(404);
        expect(res.body.message).toContain('لم يتم العثور على طالب');
    });
});
