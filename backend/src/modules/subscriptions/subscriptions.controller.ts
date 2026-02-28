import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from './subscriptions.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createSubscriptionSchema } from '../../validation/subscriptions.validation.js';

class SubscriptionController {
    static async createSubscription(req: Request, res: Response, next: NextFunction) {
        try {
            const { teacherId, endDate, amount, paymentMethod } = req.body;
            const newSubscription = await SubscriptionService.createSubscription(teacherId, { endDate, amount, paymentMethod });
            
            return SuccessResponse({ 
                res, 
                message: 'تم إضافة الاشتراك بنجاح وتفعيل حساب المعلم', 
                data: newSubscription, 
                status: 201 
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAllSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const subscriptions = await SubscriptionService.getAllSubscriptions();
            return SuccessResponse({ 
                res, 
                message: 'تم جلب جميع بطاقات الاشتراك بنجاح', 
                data: subscriptions 
            });
        } catch (error) {
            next(error);
        }
    }

    static async getTeacherSubscriptions(req: Request, res: Response, next: NextFunction) {
        try {
            const teacherId = req.params.teacherId as string;
            const subscriptions = await SubscriptionService.getTeacherSubscriptions(teacherId);
            return SuccessResponse({ 
                res, 
                message: 'تم جلب اشتراكات المعلم بنجاح', 
                data: subscriptions 
            });
        } catch (error) {
            next(error);
        }
    }
}

const router = Router();

// Protect all subscription routes globally
router.use(authenticate);

// SuperAdmin Only routes
router.post('/', authorizeRoles(UserRole.superAdmin), validate(createSubscriptionSchema), SubscriptionController.createSubscription);
router.get('/', authorizeRoles(UserRole.superAdmin), SubscriptionController.getAllSubscriptions);

// Shared route: SuperAdmin or Teacher can view specific teacher subscriptions
router.get('/:teacherId', authorizeRoles(UserRole.superAdmin, UserRole.teacher), SubscriptionController.getTeacherSubscriptions);

export default router;
