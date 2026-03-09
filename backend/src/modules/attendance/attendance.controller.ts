import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AttendanceService } from './attendance.service.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { PdfService } from '../reports/pdf.service.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { recordAttendanceSchema, batchRecordAttendanceSchema, updateAttendanceSchema } from '../../validation/attendance.validation.js';

const attendanceRouter = Router();

attendanceRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── POST /attendance — Record single attendance (QR scan or manual)
attendanceRouter.post(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(recordAttendanceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const record = await AttendanceService.recordAttendance(user.userId, req.body, teacherId);
            return SuccessResponse({ res, data: record, message: 'تم تسجيل الحضور بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ─── POST /attendance/batch — Batch record attendance
attendanceRouter.post(
    '/batch',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(batchRecordAttendanceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const result = await AttendanceService.batchRecordAttendance(user.userId, req.body, teacherId);
            return SuccessResponse({ res, data: result, message: `تم تسجيل ${result.inserted} من ${result.total} طالب` });
        } catch (error) { next(error); }
    }
);

// ─── GET /attendance/session/:sessionId — Live list for a session
attendanceRouter.get(
    '/session/:sessionId',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['sessionId'] as string;
            const search = req.query.search as string | undefined;
            const records = await AttendanceService.getSessionAttendance(sessionId, teacherId, search);
            return SuccessResponse({ res, data: records, message: 'تم جلب سجل الحضور بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /attendance/session/:sessionId/pdf — Download Attendance List PDF
attendanceRouter.get(
    '/session/:sessionId/pdf',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['sessionId'] as string;
            
            const pdfBuffer = await PdfService.generateSessionAttendancePdf(sessionId, teacherId);
            
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=attendance-${sessionId}.pdf`,
                'Content-Length': pdfBuffer.length,
            });
            res.send(pdfBuffer);
        } catch (error) { next(error); }
    }
);

// ─── POST /attendance/session/:sessionId/complete — Close session + generate snapshot
attendanceRouter.post(
    '/session/:sessionId/complete',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['sessionId'] as string;
            const result = await AttendanceService.completeSession(sessionId, teacherId);
            return SuccessResponse({ res, data: result, message: 'تم إنهاء الحصة وحفظ سجل الحضور' });
        } catch (error) { next(error); }
    }
);

// ─── GET /attendance/session/:sessionId/whatsapp-links — Formatted URLs
attendanceRouter.get(
    '/session/:sessionId/whatsapp-links',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['sessionId'] as string;
            const links = await AttendanceService.generateWhatsAppLinks(sessionId, teacherId);
            return SuccessResponse({ res, data: links, message: 'تم توليد روابط واتساب بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /attendance/snapshot/:sessionId — Get saved snapshot (instant read)
attendanceRouter.get(
    '/snapshot/:sessionId',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['sessionId'] as string;
            const snapshot = await AttendanceService.getSnapshot(sessionId, teacherId);
            return SuccessResponse({ res, data: snapshot, message: 'تم جلب سجل الحضور المحفوظ بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── PATCH /attendance/:id — Manually update attendance status (assistant only)
attendanceRouter.patch(
    '/:id',
    authorizeRoles(UserRole.assistant),
    validate(updateAttendanceSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = resolveTeacherId(user);
            const attendanceId = req.params['id'] as string;
            const { status, notes } = req.body as { status: string; notes?: string };
            const updated = await AttendanceService.updateAttendance(attendanceId, user.userId, status, teacherId, notes);
            return SuccessResponse({ res, data: updated, message: 'تم تحديث حالة الحضور بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /attendance/history/:groupId — Attendance history for a group
attendanceRouter.get(
    '/history/:groupId',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const groupId = req.params['groupId'] as string;
            const history = await AttendanceService.getGroupHistory(groupId, teacherId, req.query);
            return SuccessResponse({ res, data: history, message: 'تم جلب سجل الحضور التاريخي بنجاح' });
        } catch (error) { next(error); }
    }
);

export default attendanceRouter;
