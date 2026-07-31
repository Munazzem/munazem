/**
 * tests/integration/attendance.api.test.ts
 *
 * Integration tests for the Attendance module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedGroup, seedStudent, seedSession, seedAttendance } from '../helpers/db.helper.js';
import { AttendanceStatus, SessionStatus } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

// =============================================================================
// POST /attendance
// =============================================================================
describe('POST /attendance', () => {

    it('يُسجل الحضور بنجاح للطالب في الحصة', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any, { barcode: '12345' });

        const res = await app
            .post('/attendance')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                studentId: '12345', // barcode matches studentId field in DTO
                status: AttendanceStatus.PRESENT
            });

        expect(res.status).toBe(201);
        expect(res.body.data.studentId).toBe(student._id.toString());
        expect(res.body.data.status).toBe(AttendanceStatus.PRESENT);
    });

    it('يرفض تسجيل الحضور إذا لم يتم العثور على الباركود', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });

        const res = await app
            .post('/attendance')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                studentId: 'unknown_barcode'
            });

        expect(res.status).toBe(404);
    });
});

// =============================================================================
// POST /attendance/batch
// =============================================================================
describe('POST /attendance/batch', () => {

    it('يُسجل حضور قائمة من الطلاب بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student1 = await seedStudent(group._id as any, { studentCode: 'A1' });
        const student2 = await seedStudent(group._id as any, { studentCode: 'A2' });

        const res = await app
            .post('/attendance/batch')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                records: [
                    { studentId: student1._id.toString(), status: AttendanceStatus.PRESENT },
                    { studentId: student2._id.toString(), status: AttendanceStatus.PRESENT }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.data.inserted).toBe(2);
    });
});

// =============================================================================
// GET /attendance/session/:sessionId
// =============================================================================
describe('GET /attendance/session/:sessionId', () => {

    it('يجلب سجل الحضور للحصة بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any);
        await seedAttendance(session._id as any, student._id as any);

        const res = await app
            .get(`/attendance/session/${session._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.data).toBeInstanceOf(Array);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].studentId._id).toBe(student._id.toString());
    });
});

// =============================================================================
// PATCH /attendance/:id
// =============================================================================
describe('PATCH /attendance/:id', () => {

    it('يُحدّث حالة الحضور يدوياً (مثلاً من حاضر إلى غائب)', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any);
        const record = await seedAttendance(session._id as any, student._id as any, { status: AttendanceStatus.PRESENT });

        const res = await app
            .patch(`/attendance/${record._id}`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                status: AttendanceStatus.ABSENT,
                notes: 'خطأ في التسجيل'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(AttendanceStatus.ABSENT);
        expect(res.body.data.notes).toBe('خطأ في التسجيل');
    });
});

// =============================================================================
// POST /attendance/session/:sessionId/complete
// =============================================================================
describe('POST /attendance/session/:sessionId/complete', () => {

    it('ينهي الحصة ويأخذ snapshot للطلاب بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any, status: SessionStatus.SCHEDULED });
        await seedStudent(group._id as any); // student in group but not present yet (so ABSENT after complete)

        const res = await app
            .post(`/attendance/session/${session._id}/complete`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('تم إنهاء الحصة');
    });
});
