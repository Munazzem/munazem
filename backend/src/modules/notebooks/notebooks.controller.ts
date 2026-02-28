import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { NotebooksService } from './notebooks.service.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';

const notebooksRouter = Router();

notebooksRouter.use(authenticate);

const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── POST /notebooks — Add new notebook (Teacher only)
notebooksRouter.post(
    '/',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const nb = await NotebooksService.createNotebook(teacherId, req.body);
            return SuccessResponse({ res, data: nb, message: 'تم إضافة المذكرة بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

// ─── GET /notebooks — List all (Teacher + Assistant, read-only)
notebooksRouter.get(
    '/',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const result = await NotebooksService.getNotebooks(teacherId, req.query);
            return SuccessResponse({ res, data: result, message: 'تم جلب المذكرات بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /notebooks/:id — Get single (Teacher + Assistant, read-only)
notebooksRouter.get(
    '/:id',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const nb = await NotebooksService.getNotebookById(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data: nb, message: 'تم جلب المذكرة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── PUT /notebooks/:id — Update details (Teacher only)
notebooksRouter.put(
    '/:id',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const nb = await NotebooksService.updateNotebook(req.params['id'] as string, teacherId, req.body);
            return SuccessResponse({ res, data: nb, message: 'تم تعديل المذكرة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── PATCH /notebooks/:id/restock — Add stock (Teacher only)
notebooksRouter.patch(
    '/:id/restock',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const nb = await NotebooksService.addStock(
                req.params['id'] as string,
                teacherId,
                Number(req.body.quantity)
            );
            return SuccessResponse({ res, data: nb, message: `تم إضافة ${req.body.quantity} نسخة للمخزن` });
        } catch (error) { next(error); }
    }
);

// ─── DELETE /notebooks/:id — Delete (Teacher only)
notebooksRouter.delete(
    '/:id',
    authorizeRoles(UserRole.teacher),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            await NotebooksService.deleteNotebook(req.params['id'] as string, teacherId);
            return SuccessResponse({ res, data: null, message: 'تم حذف المذكرة بنجاح' });
        } catch (error) { next(error); }
    }
);

export default notebooksRouter;
