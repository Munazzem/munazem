import { Router } from 'express';
import { UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { BadRequestException } from '../../common/utils/response/error.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { initializeClientForTeacher, getClientStatus, destroyClientForTeacher } from '../../common/utils/whatsapp.service.js';
import { UserModel } from '../../database/models/user.model.js';
import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { SubscriptionStatus, SubscriptionPlan } from '../../common/enums/enum.service.js';
const whatsappRouter = Router();
whatsappRouter.use(authenticate);
// ─── POST /whatsapp/connect — Start WhatsApp client for the logged-in teacher
// The frontend calls this from the Settings page → triggers QR generation.
whatsappRouter.post('/connect', authorizeRoles(UserRole.teacher), async (req, res, next) => {
    try {
        const user = req.user;
        const teacherId = user.userId;
        const activeSubscription = await SubscriptionModel.findOne({
            teacherId,
            status: SubscriptionStatus.ACTIVE,
            endDate: { $gt: new Date() },
        }).sort({ endDate: -1 }).lean();
        if (!activeSubscription || activeSubscription.planTier !== SubscriptionPlan.PREMIUM) {
            return next(BadRequestException({
                message: 'ميزة إشعارات الواتساب متاحة فقط في الباقة المتميزة',
            }));
        }
        // Kick off the client (non-blocking — Puppeteer starts in bg)
        await initializeClientForTeacher(teacherId);
        return SuccessResponse({
            res,
            data: null,
            message: 'جاري تهيئة اتصال واتساب... يرجى الانتظار لمسح رمز QR',
            status: 202,
        });
    }
    catch (error) {
        next(error);
    }
});
// ─── GET /whatsapp/status — Connection status + QR code for the logged-in teacher
// The frontend polls this endpoint to:
//   1. Detect when a QR code is available → render it
//   2. Detect when status flips to 'connected' → show success
whatsappRouter.get('/status', authorizeRoles(UserRole.teacher), async (req, res, next) => {
    try {
        const user = req.user;
        const teacherId = user.userId;
        const teacher = await UserModel.findById(teacherId, { whatsappStatus: 1, whatsappQr: 1 }).lean();
        const poolStatus = getClientStatus(teacherId);
        return SuccessResponse({
            res,
            data: {
                status: teacher?.whatsappStatus ?? 'disconnected',
                qrCode: teacher?.whatsappQr ?? null,
                clientReady: poolStatus === 'connected',
            },
            message: 'تم جلب حالة اتصال واتساب',
        });
    }
    catch (error) {
        next(error);
    }
});
// ─── POST /whatsapp/disconnect — Tear down the teacher's WhatsApp client
whatsappRouter.post('/disconnect', authorizeRoles(UserRole.teacher), async (req, res, next) => {
    try {
        const user = req.user;
        const teacherId = user.userId;
        // 1. Kill Puppeteer + delete local session → next connect = fresh QR
        await destroyClientForTeacher(teacherId);
        // 2. Update DB
        await UserModel.updateOne({ _id: teacherId }, { whatsappStatus: 'disconnected', whatsappQr: null });
        return SuccessResponse({
            res,
            data: null,
            message: 'تم فصل اتصال واتساب',
        });
    }
    catch (error) {
        next(error);
    }
});
export default whatsappRouter;
//# sourceMappingURL=whatsapp.controller.js.map