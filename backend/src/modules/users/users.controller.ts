import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { UserService } from './users.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { userCreationSchema } from '../../validation/user.validation.js';
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
            next(error);
        }
    }
}

const router = Router();

// Protect all user routes globally by applying the middleware to the router
router.use(authenticate);

// Only SuperAdmin and Teacher can create new users (Teacher creates Assistant, SuperAdmin creates Teacher)
router.post('/', authorizeRoles(UserRole.superAdmin, UserRole.teacher), validate(userCreationSchema), UserController.createUser);

export default router;