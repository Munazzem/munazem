import { Router } from 'express';
import { SubscriptionService } from './subscriptions.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createSubscriptionSchema } from '../../validation/subscriptions.validation.js';
class SubscriptionController {
    static async createSubscription(req, res, next) {
        try {
            const { teacherId, planTier, durationMonths, isFreeTrial, studentsCount, paymentMethod, promoCode } = req.body;
            const newSubscription = await SubscriptionService.createSubscription(teacherId, { planTier, durationMonths, isFreeTrial, studentsCount, paymentMethod, promoCode });
            return SuccessResponse({
                res,
                message: 'تم إضافة الاشتراك بنجاح وتفعيل حساب المعلم',
                data: newSubscription,
                status: 201,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAllSubscriptions(req, res, next) {
        try {
            const subscriptions = await SubscriptionService.getAllSubscriptions();
            return SuccessResponse({
                res,
                message: 'تم جلب جميع بطاقات الاشتراك بنجاح',
                data: subscriptions,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getTeacherSubscriptions(req, res, next) {
        try {
            const teacherId = req.params.teacherId;
            const subscriptions = await SubscriptionService.getTeacherSubscriptions(teacherId);
            return SuccessResponse({
                res,
                message: 'تم جلب اشتراكات المعلم بنجاح',
                data: subscriptions,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAvailablePlans(_req, res, next) {
        try {
            const plans = await SubscriptionService.getAvailablePlans();
            return SuccessResponse({
                res,
                message: 'تم جلب الباقات المتاحة بنجاح',
                data: plans,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
const router = Router();
router.use(authenticate);
// Public to all authenticated users (teacher can see available plans)
router.get('/plans', SubscriptionController.getAvailablePlans);
// SuperAdmin Only routes
router.post('/', authorizeRoles(UserRole.superAdmin), validate(createSubscriptionSchema), SubscriptionController.createSubscription);
router.get('/', authorizeRoles(UserRole.superAdmin), SubscriptionController.getAllSubscriptions);
// Shared: SuperAdmin or Teacher
router.get('/:teacherId', authorizeRoles(UserRole.superAdmin, UserRole.teacher), SubscriptionController.getTeacherSubscriptions);
export default router;
//# sourceMappingURL=subscriptions.controller.js.map