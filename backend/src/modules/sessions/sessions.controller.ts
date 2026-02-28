import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SessionService } from './sessions.service.js';
import { SessionStatus, UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';

const sessionRouter = Router();

sessionRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── POST /sessions — Create a new session
sessionRouter.post(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
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

export default sessionRouter;
