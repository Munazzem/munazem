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
// POST /attendance/batch-sync (Offline Outbox Sync)
// =============================================================================
describe('POST /attendance/batch-sync', () => {

    it('يُزامن المسحات المعلقة بنجاح وبطريقة Idempotent تمنع التكرار', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student1 = await seedStudent(group._id as any, { studentCode: 'S1' });
        const student2 = await seedStudent(group._id as any, { studentCode: 'S2' });

        const syncPayload = {
            sessionId: session._id.toString(),
            records: [
                {
                    clientMutationId: 'mutation-uuid-1',
                    studentId: student1._id.toString(),
                    status: AttendanceStatus.PRESENT,
                    scannedAt: new Date().toISOString()
                },
                {
                    clientMutationId: 'mutation-uuid-2',
                    studentId: student2._id.toString(),
                    status: AttendanceStatus.LATE,
                    scannedAt: new Date().toISOString()
                }
            ]
        };

        // First sync run: both should be upserted
        const res1 = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send(syncPayload);

        expect(res1.status).toBe(200);
        expect(res1.body.data.upsertedCount).toBe(2);
        expect(res1.body.data.matchedCount).toBe(0);

        // Second sync run (replay of same batch): should match existing records without duplicate error (409)
        const res2 = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send(syncPayload);

        expect(res2.status).toBe(200);
        expect(res2.body.data.upsertedCount).toBe(0);
        expect(res2.body.data.matchedCount).toBe(2);
    });

    it('يقبل المزامنة بأمان على حصة مكتملة COMPLETED ويُسجل الحضور بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any, status: SessionStatus.COMPLETED });
        const student = await seedStudent(group._id as any);

        const res = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                records: [
                    {
                        clientMutationId: 'mutation-uuid-3',
                        studentId: student._id.toString(),
                        status: AttendanceStatus.PRESENT
                    }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
        expect(res.body.data.upsertedCount).toBe(1);

        // Verify attendance record exists in DB with PRESENT status
        const { AttendanceModel } = await import('../../src/database/models/attendance.model.js');
        const record = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id });
        expect(record).not.toBeNull();
        expect(record?.status).toBe(AttendanceStatus.PRESENT);
    });

    it('يرفض المزامنة على حصة مُلغاة CANCELLED', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any, status: SessionStatus.CANCELLED });
        const student = await seedStudent(group._id as any);

        const res = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                records: [
                    {
                        clientMutationId: 'mutation-uuid-4',
                        studentId: student._id.toString(),
                        status: AttendanceStatus.PRESENT
                    }
                ]
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('مُلغاة');
    });

    it('يقبل المزامنة باستخدام rawToken لطالب زائر/أوفلاين بدون studentId ويقوم بحله بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any, { studentCode: 'RAW-CODE-99' });

        const res = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                records: [
                    {
                        clientMutationId: 'mutation-uuid-raw-1',
                        rawToken: 'RAW-CODE-99',
                        status: AttendanceStatus.PRESENT,
                        scannedAt: new Date().toISOString(),
                    }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
        expect(res.body.data.upsertedCount).toBe(1);

        const { AttendanceModel } = await import('../../src/database/models/attendance.model.js');
        const record = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id });
        expect(record).not.toBeNull();
        expect(record?.status).toBe(AttendanceStatus.PRESENT);
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

    it('يحفظ حالة الواجب homeworkDone داخل الـ snapshot بدقة للطلاب الحاضرين', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any, status: SessionStatus.SCHEDULED });
        const student1 = await seedStudent(group._id as any, { studentCode: 'HW-1' });
        const student2 = await seedStudent(group._id as any, { studentCode: 'HW-2' });

        // Record student 1 as present with homeworkDone: true
        await seedAttendance(session._id as any, student1._id as any, {
            status: AttendanceStatus.PRESENT,
            homeworkDone: true,
        });

        // Record student 2 as present with homeworkDone: false
        await seedAttendance(session._id as any, student2._id as any, {
            status: AttendanceStatus.PRESENT,
            homeworkDone: false,
        });

        const res = await app
            .post(`/attendance/session/${session._id}/complete`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        const { AttendanceSnapshotModel } = await import('../../src/database/models/attendance-snapshot.model.js');
        const snapshot = await AttendanceSnapshotModel.findOne({ sessionId: session._id });
        expect(snapshot).not.toBeNull();
        
        const snap1 = snapshot?.presentStudents.find(s => s.studentId.toString() === student1._id.toString());
        const snap2 = snapshot?.presentStudents.find(s => s.studentId.toString() === student2._id.toString());
        
        expect(snap1?.homeworkDone).toBe(true);
        expect(snap2?.homeworkDone).toBe(false);
    });
});

// =============================================================================
// Homework Tracking: Record, Update, Batch-Sync
// =============================================================================
describe('Homework Tracking Features', () => {

    it('يُسجل الحضور مع homeworkDone بنجاح ويسمح بتعديل حالة الواجب عبر PATCH', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any, { barcode: 'HW-BARCODE-1' });

        // 1. Record attendance with explicit homeworkDone: true
        const recordRes = await app
            .post('/attendance')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                studentId: student._id.toString(),
                status: AttendanceStatus.PRESENT,
                homeworkDone: true
            });

        expect(recordRes.status).toBe(201);
        expect(recordRes.body.data.homeworkDone).toBe(true);

        const attendanceId = recordRes.body.data._id;

        // 2. Update homeworkDone to false via PATCH /attendance/:id
        const patchRes = await app
            .patch(`/attendance/${attendanceId}`)
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                homeworkDone: false
            });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.homeworkDone).toBe(false);
    });

    it('يُزامن المسحات المعلقة مع homeworkDone بنجاح في batch-sync', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any, { studentCode: 'HW-SYNC-1' });

        const syncRes = await app
            .post('/attendance/batch-sync')
            .set('Authorization', bearerHeader(makeTeacherToken()))
            .send({
                sessionId: session._id.toString(),
                records: [
                    {
                        clientMutationId: 'hw-mut-1',
                        studentId: student._id.toString(),
                        status: AttendanceStatus.PRESENT,
                        homeworkDone: false,
                        scannedAt: new Date().toISOString(),
                    }
                ]
            });

        expect(syncRes.status).toBe(200);
        expect(syncRes.body.data.success).toBe(true);

        const { AttendanceModel } = await import('../../src/database/models/attendance.model.js');
        const record = await AttendanceModel.findOne({ sessionId: session._id, studentId: student._id });
        expect(record).not.toBeNull();
        expect(record?.homeworkDone).toBe(false);
    });

    it('يولد روابط الواتساب مع حالة الواجب فقط عندما تكون الميزة مفعلة وللطلاب الحاضرين', async () => {
        // Teacher with homeworkTracking: true
        await seedTeacher({
            features: { homeworkTracking: true } as any
        });
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const studentPresentDone = await seedStudent(group._id as any, { studentName: 'طالب تم الواجب', studentCode: 'HW-WA-1', parentPhone: '01011111111' });
        const studentPresentUndone = await seedStudent(group._id as any, { studentName: 'طالب بلا واجب', studentCode: 'HW-WA-2', parentPhone: '01022222222' });
        const studentAbsent = await seedStudent(group._id as any, { studentName: 'طالب غائب', studentCode: 'HW-WA-3', parentPhone: '01033333333' });

        await seedAttendance(session._id as any, studentPresentDone._id as any, {
            status: AttendanceStatus.PRESENT,
            homeworkDone: true,
        });

        await seedAttendance(session._id as any, studentPresentUndone._id as any, {
            status: AttendanceStatus.PRESENT,
            homeworkDone: false,
        });

        const res = await app
            .get(`/attendance/session/${session._id}/whatsapp-links`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        const links: any[] = res.body.data;
        expect(links.length).toBe(3);

        const doneLink = links.find(l => l.studentId === studentPresentDone._id.toString());
        const undoneLink = links.find(l => l.studentId === studentPresentUndone._id.toString());
        const absentLink = links.find(l => l.studentId === studentAbsent._id.toString());

        expect(doneLink.homeworkDone).toBe(true);
        expect(decodeURIComponent(doneLink.whatsappLink)).toContain('الواجب: تم تسليمه بنجاح ✅');

        expect(undoneLink.homeworkDone).toBe(false);
        expect(decodeURIComponent(undoneLink.whatsappLink)).toContain('الواجب: لم يتم تسليمه ❌');

        expect(absentLink.homeworkDone).toBeNull();
        expect(decodeURIComponent(absentLink.whatsappLink)).not.toContain('الواجب');
    });

    it('يولد كشف الـ PDF مع عمود الواجب عندما تكون الميزة مفعلة للمعلم', async () => {
        await seedTeacher({
            features: { homeworkTracking: true } as any
        });
        const group = await seedGroup();
        const session = await seedSession({ groupId: group._id as any });
        const student = await seedStudent(group._id as any, { studentName: 'طالب تجربة PDF' });

        await seedAttendance(session._id as any, student._id as any, {
            status: AttendanceStatus.PRESENT,
            homeworkDone: true,
        });

        const res = await app
            .get(`/attendance/session/${session._id}/pdf`)
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.text).toContain('الواجب');
        expect(res.text).toContain('تم');
    });
});
