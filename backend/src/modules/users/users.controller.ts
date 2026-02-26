import { Router } from 'express';
import type { Request, Response } from 'express';
import { UserService } from './users.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { ErrorResponse, UnauthorizedException } from '../../common/utils/response/error.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';

class UserController {

    static async createUser(req: Request, res: Response) {
        try {
            const currentUser = (req as any).user;

            if (!currentUser) {
                return UnauthorizedException({ message: 'يجب تسجيل الدخول لإنشاء مستخدم جديد' });
            }

            const newUser = await UserService.createUser(
                currentUser.role,
                currentUser.userId,
                req.body
            );

            return SuccessResponse({ res, message: 'تم إنشاء الحساب بنجاح', data: newUser, status: 201 });

        } catch (error: any) {
            return ErrorResponse({ message: error.message || 'فشل في إنشاء المستخدم', extra: error.cause?.extra, status: error.cause?.status || 500 });
        }
    }
}

const router = Router();

// Protect all user routes globally by applying the middleware to the router
router.use(authenticate);

// Only SuperAdmin and Teacher can create new users (Teacher creates Assistant, SuperAdmin creates Teacher)
router.post('/', authorizeRoles(UserRole.superAdmin, UserRole.teacher), UserController.createUser);

export default router;