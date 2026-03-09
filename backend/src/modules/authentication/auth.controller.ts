import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { login, refreshTokens } from './auth.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { loginSchema } from '../../validation/auth.validation.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { UserModel } from '../../database/models/user.model.js';
import { PasswordUtil } from '../../common/utils/password.util.js';
import { BadRequestException, UnauthorizedException } from '../../common/utils/response/error.responce.js';

const router = Router();

router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        const result = await login(req.body);
        SuccessResponse({ res, message: result.message, data: { token: result.token, refreshToken: result.refreshToken, user: result.user } });
    } catch (error) {
        next(error);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await refreshTokens(refreshToken);
        SuccessResponse({ res, message: 'Tokens refreshed successfully', data: result });
    } catch (error) {
        next(error);
    }
});

// GET /auth/me — get current user's profile
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.userId;
        const user = await UserModel.findById(userId).select('-password').lean();
        if (!user) throw UnauthorizedException({ message: 'المستخدم غير موجود' });
        SuccessResponse({ res, message: 'تم جلب بيانات الحساب', data: user });
    } catch (error) {
        next(error);
    }
});

// PATCH /auth/me — update current user's profile (name, email, phone)
router.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.userId;
        const { name, email, phone } = req.body;

        if (phone) {
            const existing = await UserModel.findOne({ phone, _id: { $ne: userId } }).lean();
            if (existing) throw BadRequestException({ message: 'رقم الهاتف مسجل بالفعل لحساب آخر' });
        }

        const updated = await UserModel.findByIdAndUpdate(
            userId,
            { ...(name && { name }), ...(email && { email }), ...(phone && { phone }) },
            { new: true }
        ).select('-password').lean();

        SuccessResponse({ res, message: 'تم تحديث بيانات الحساب بنجاح', data: updated });
    } catch (error) {
        next(error);
    }
});

// PATCH /auth/change-password — change current user's password
router.patch('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw BadRequestException({ message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
        }
        if (newPassword.length < 6) {
            throw BadRequestException({ message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
        }

        const user = await UserModel.findById(userId).select('+password');
        if (!user) throw UnauthorizedException({ message: 'المستخدم غير موجود' });

        const isValid = await PasswordUtil.comparePassword(currentPassword, user.password as string);
        if (!isValid) throw BadRequestException({ message: 'كلمة المرور الحالية غير صحيحة' });

        user.password = await PasswordUtil.hashPassword(newPassword);
        await user.save();

        SuccessResponse({ res, message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (error) {
        next(error);
    }
});

export default router;