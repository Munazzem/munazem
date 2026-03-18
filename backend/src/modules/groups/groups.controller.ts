import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { GroupService } from './groups.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { UnauthorizedException } from '../../common/utils/response/error.responce.js';
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

    static async createGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const group = await GroupService.createGroup(teacherId, req.body);
            return SuccessResponse({ res, message: 'تم إنشاء المجموعة بنجاح', data: group, status: 201 });
        } catch (error) {
            next(error);
        }
    }

    static async getGroups(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const groups = await GroupService.getGroupsByTeacherId(teacherId, req.query);
            return SuccessResponse({ res, message: 'تم جلب المجموعات بنجاح', data: groups });
        } catch (error) {
            next(error);
        }
    }

    static async getGroupById(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const group = await GroupService.getGroupById(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم جلب بيانات المجموعة', data: group });
        } catch (error) {
            next(error);
        }
    }

    static async updateGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            const updatedGroup = await GroupService.updateGroup(req.params.id as string, teacherId, req.body);
            return SuccessResponse({ res, message: 'تم التعديل بنجاح', data: updatedGroup });
        } catch (error) {
            next(error);
        }
    }

    static async deleteGroup(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            const teacherId = GroupController.extractTeacherId(user);
            await GroupService.deleteGroup(req.params.id as string, teacherId);
            return SuccessResponse({ res, message: 'تم الحذف بنجاح' });
        } catch (error) {
            next(error);
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

router.post('/', authorizeRoles(UserRole.assistant, UserRole.teacher), validate(createGroupSchema), GroupController.createGroup);
router.put('/:id', authorizeRoles(UserRole.assistant, UserRole.teacher), validate(updateGroupSchema), GroupController.updateGroup);
router.delete('/:id', authorizeRoles(UserRole.assistant, UserRole.teacher), GroupController.deleteGroup);

router.get('/', authorizeRoles(UserRole.teacher, UserRole.assistant), GroupController.getGroups);
router.get('/:id', authorizeRoles(UserRole.teacher, UserRole.assistant), GroupController.getGroupById);

export default router;
