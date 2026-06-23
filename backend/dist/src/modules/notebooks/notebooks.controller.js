import { Router } from 'express';
import { NotebooksService } from './notebooks.service.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createNotebookSchema, updateNotebookSchema, restockNotebookSchema } from '../../validation/notebook.validation.js';
const notebooksRouter = Router();
notebooksRouter.use(authenticate);
const resolveTeacherId = (user) => user.role === UserRole.assistant ? user.teacherId : user.userId;
// ─── POST /notebooks — Add new notebook (Teacher + Assistant)
notebooksRouter.post('/', authorizeRoles(UserRole.teacher, UserRole.assistant), validate(createNotebookSchema), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const nb = await NotebooksService.createNotebook(teacherId, req.body);
        return SuccessResponse({ res, data: nb, message: 'تم إضافة المذكرة بنجاح', status: 201 });
    }
    catch (error) {
        next(error);
    }
});
// ─── GET /notebooks — List all (Teacher + Assistant)
notebooksRouter.get('/', authorizeRoles(UserRole.teacher, UserRole.assistant), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const result = await NotebooksService.getNotebooks(teacherId, req.query);
        return SuccessResponse({ res, data: result, message: 'تم جلب المذكرات بنجاح' });
    }
    catch (error) {
        next(error);
    }
});
// ─── GET /notebooks/reservations — List all reservations (Teacher + Assistant)
notebooksRouter.get('/reservations', authorizeRoles(UserRole.teacher, UserRole.assistant), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const result = await NotebooksService.getReservations(teacherId, req.query);
        return SuccessResponse({ res, data: result, message: 'تم جلب الحجوزات بنجاح' });
    }
    catch (error) {
        next(error);
    }
});
// ─── GET /notebooks/:id — Get single (Teacher + Assistant)
notebooksRouter.get('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const nb = await NotebooksService.getNotebookById(req.params['id'], teacherId);
        return SuccessResponse({ res, data: nb, message: 'تم جلب المذكرة بنجاح' });
    }
    catch (error) {
        next(error);
    }
});
// ─── PUT /notebooks/:id — Update details (Teacher + Assistant)
notebooksRouter.put('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), validate(updateNotebookSchema), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const nb = await NotebooksService.updateNotebook(req.params['id'], teacherId, req.body);
        return SuccessResponse({ res, data: nb, message: 'تم تعديل المذكرة بنجاح' });
    }
    catch (error) {
        next(error);
    }
});
// ─── PATCH /notebooks/:id/restock — Add stock (Teacher + Assistant)
notebooksRouter.patch('/:id/restock', authorizeRoles(UserRole.teacher, UserRole.assistant), validate(restockNotebookSchema), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        const nb = await NotebooksService.addStock(req.params['id'], teacherId, Number(req.body.quantity));
        return SuccessResponse({ res, data: nb, message: `تم إضافة ${req.body.quantity} نسخة للمخزن` });
    }
    catch (error) {
        next(error);
    }
});
// ─── DELETE /notebooks/:id — Delete (Teacher + Assistant)
notebooksRouter.delete('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), async (req, res, next) => {
    try {
        const teacherId = resolveTeacherId(req.user);
        await NotebooksService.deleteNotebook(req.params['id'], teacherId);
        return SuccessResponse({ res, data: null, message: 'تم حذف المذكرة بنجاح' });
    }
    catch (error) {
        next(error);
    }
});
export default notebooksRouter;
//# sourceMappingURL=notebooks.controller.js.map