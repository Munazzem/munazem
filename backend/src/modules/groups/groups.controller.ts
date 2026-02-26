import { Router } from 'express';
import type { Request, Response } from 'express';
import { GroupService } from './groups.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { ErrorResponse, UnauthorizedException } from '../../common/utils/response/error.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createGroupSchema, updateGroupSchema } from '../../validation/group.validation.js';
import { UserRole } from '../../common/enums/enum.service.js';

class GroupController {
    
    // Helper to get the correct teacherId whether the user is a Teacher or an Assistant
    private static extractTeacherId(user: any): string {
        if (user.role === UserRole.teacher) return user.userId;
        if (user.role === UserRole.assistant && user.teacherId) return user.teacherId;
        throw UnauthorizedException({ message: 'طبيعة الحساب غير صالحة للقيام بهذه العملية' });
    }

    static async createGroup(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const group = await GroupService.createGroup(teacherId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء المجموعة بنجاح', data: group, status: 201 });
        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'فشل في إنشاء المجموعة', extra: error.cause?.extra, status: error.cause?.status || 500 });
        }
    }

    static async getGroups(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const groups = await GroupService.getGroupsByTeacherId(teacherId);
            return SuccessResponse({ res, message: 'تم جلب المجموعات بنجاح', data: groups });
        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'فشل في جلب المجموعات', extra: error.cause?.extra, status: error.cause?.status || 500 });
        }
    }

    static async getGroupById(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const group = await GroupService.getGroupById(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم جلب بيانات المجموعة', data: group });
        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'المجموعة غير موجودة', extra: error.cause?.extra, status: error.cause?.status || 404 });
        }
    }

    static async updateGroup(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const updatedGroup = await GroupService.updateGroup(req.params.id as string, teacherId, req.body);
            return SuccessResponse({ res, message: 'تم التعديل بنجاح', data: updatedGroup });
        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'فشل في التعديل', extra: error.cause?.extra, status: error.cause?.status || 500 });
        }
    }

    static async deleteGroup(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            await GroupService.deleteGroup(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم الحذف بنجاح' });
        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'فشل في حذف المجموعة', extra: error.cause?.extra, status: error.cause?.status || 500 });
        }
    }
}

const router = Router();
router.use(authenticate);

// ============================================
// CRITICAL ROLE SEGREGATION: 
// Assistants have Write permissions (POST, PUT, DELETE)
// Teachers and Assistants have Read permissions (GET)
// ============================================

router.post('/', authorizeRoles(UserRole.assistant), validate(createGroupSchema), GroupController.createGroup);
router.put('/:id', authorizeRoles(UserRole.assistant), validate(updateGroupSchema), GroupController.updateGroup);
router.delete('/:id', authorizeRoles(UserRole.assistant), GroupController.deleteGroup);

router.get('/', authorizeRoles(UserRole.teacher, UserRole.assistant), GroupController.getGroups);
router.get('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), GroupController.getGroupById);

export default router;
