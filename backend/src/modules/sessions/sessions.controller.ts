import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SessionService } from './sessions.service.js';
import { SessionStatus, UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createSessionSchema, updateSessionStatusSchema } from '../../validation/session.validation.js';

const sessionRouter = Router();

sessionRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── POST /sessions — Create a new session
sessionRouter.post(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(createSessionSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const session = await SessionService.createSession(teacherId, req.body);
            return SuccessResponse({ res, data: session, message: 'تم إنشاء الحصة بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ─── GET /sessions — Get all sessions (paginated)
sessionRouter.get(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessions = await SessionService.getSessionsByTeacher(teacherId, req.query);
            return SuccessResponse({ res, data: sessions, message: 'تم جلب الحصص بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /sessions/:id — Get session by ID
sessionRouter.get(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['id'] as string;
            const session = await SessionService.getSessionById(sessionId, teacherId);
            return SuccessResponse({ res, data: session, message: 'تم جلب الحصة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── PATCH /sessions/:id/status — Update session status
sessionRouter.patch(
    '/:id/status',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    validate(updateSessionStatusSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const sessionId = req.params['id'] as string;
            const { status } = req.body as { status: SessionStatus };
            const updated = await SessionService.updateSessionStatus(sessionId, teacherId, status);
            return SuccessResponse({ res, data: updated, message: 'تم تحديث حالة الحصة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── POST /sessions/generate-week?weekStart=2026-03-07 — Auto-generate all sessions for a week
sessionRouter.post(
    '/generate-week',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const weekStart = (req.query['weekStart'] as string) ?? new Date().toISOString().split('T')[0];
            const result = await SessionService.generateWeekSessions(teacherId, weekStart);
            return SuccessResponse({ res, data: result, message: result.message });
        } catch (error) { next(error); }
    }
);

// ─── POST /sessions/generate-month?year=2026&month=3 — Auto-generate sessions for a full month
sessionRouter.post(
    '/generate-month',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const year  = parseInt(req.query['year']  as string) || new Date().getFullYear();
            const month = parseInt(req.query['month'] as string) || (new Date().getMonth() + 1);
            if (month < 1 || month > 12) {
                return res.status(400).json({ message: 'قيمة الشهر يجب أن تكون بين 1 و 12' });
            }
            const result = await SessionService.generateMonthSessions(teacherId, year, month);
            return SuccessResponse({ res, data: result, message: result.message });
        } catch (error) { next(error); }
    }
);

export default sessionRouter;
