import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { UserService } from './users.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { userCreationSchema, userUpdateSchema, paySalarySchema } from '../../validation/user.validation.js';
import { UserRole } from '../../common/enums/enum.service.js';

class UserController {

    static async createUser(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUser = (req as any).user;
            const newUser = await UserService.createUser(
                currentUser.role,
                currentUser.userId,
                req.body
            );
            return SuccessResponse({ res, message: 'تم إنشاء الحساب بنجاح', data: newUser, status: 201 });
        } catch (error) {
            console.error('Error in createUser:', error);
            next(error);
        }
    }

    static async getUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUser = (req as any).user;
            const users = await UserService.getUsers(
                currentUser.role,
                currentUser.userId,
                req.query
            );
            return SuccessResponse({ res, message: 'تم جلب المستخدمين بنجاح', data: users, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    static async updateUser(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUser = (req as any).user;
            const targetUserId = req.params.id as string;
            const updatedUser = await UserService.updateUser(
                currentUser.role,
                currentUser.userId,
                targetUserId,
                req.body
            );
            return SuccessResponse({ res, message: 'تم تعديل الحساب بنجاح', data: updatedUser, status: 200 });
        } catch (error) {
            next(error);
        }
    }

    static async deleteUser(req: Request, res: Response, next: NextFunction) {
        try {
            const currentUser = (req as any).user;
            const targetUserId = req.params.id as string;
            const result = await UserService.deleteUser(
                currentUser.role,
                currentUser.userId,
                targetUserId
            );
            return SuccessResponse({ res, message: result.message, status: 200 });
        } catch (error) {
            next(error);
        }
    }
}

const router = Router();

// Protect all user routes globally by applying the middleware to the router
router.use(authenticate);

// Only SuperAdmin and Teacher can create new users (Teacher creates Assistant, SuperAdmin creates Teacher)
router.post('/', authorizeRoles(UserRole.superAdmin, UserRole.teacher), validate(userCreationSchema), UserController.createUser);

// Get users based on requester's role
router.get('/', UserController.getUsers);

// Update user details
router.put('/:id', authorizeRoles(UserRole.superAdmin, UserRole.teacher), validate(userUpdateSchema), UserController.updateUser);

// Delete user
router.delete('/:id', authorizeRoles(UserRole.superAdmin, UserRole.teacher), UserController.deleteUser);

// Pay assistant salary — records an expense transaction
router.post(
    '/:id/pay-salary',
    authorizeRoles(UserRole.teacher),
    validate(paySalarySchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId    = (req as any).user.userId;
            const assistantId  = req.params.id as string;
            const { amount, notes } = req.body;
            const tx = await UserService.paySalary(teacherId, assistantId, amount, notes);
            return SuccessResponse({ res, data: tx, message: 'تم تسجيل الراتب بنجاح', status: 201 });
        } catch (error) { next(error); }
    }
);

export default router;