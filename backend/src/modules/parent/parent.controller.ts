import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { ParentService } from './parent.service.js';
import { ParentAuthService } from './parent-auth.service.js';
import { ParentAppService } from './parent-app.service.js';
import { InquiriesService } from '../inquiries/inquiries.service.js';
import { CardsService } from '../cards/cards.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticateParent } from '../../middlewares/parent-auth.middleware.js';
import type { AuthenticatedParentRequest } from '../../middlewares/parent-auth.middleware.js';
import { parentLoginRateLimiters } from '../../middlewares/rate-limit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createParentInquirySchema,
  getParentInquiriesSchema,
  parentInquiryIdParamSchema,
  updateParentInquirySchema,
} from '../../validation/parent-inquiry.validation.js';

const isTest = process.env.NODE_ENV === 'test';

// Rate Limit S1: 5 inquiry creations per hour per parentId
export const parentInquiryCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 1000 : 5,
  keyGenerator: (req: Request) =>
    (req as AuthenticatedParentRequest).parent?.parentId || req.ip || 'anonymous',
  message: {
    message:
      'تجاوزت الحد المسموح لإنشاء الطلبات (5 طلبات في الساعة)، يرجى المحاولة لاحقاً',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limit S2: 20 inquiry edits/cancellations per hour per parentId
export const parentInquiryMutateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 1000 : 20,
  keyGenerator: (req: Request) =>
    (req as AuthenticatedParentRequest).parent?.parentId || req.ip || 'anonymous',
  message: {
    message:
      'تجاوزت الحد المسموح لتعديل أو إلغاء الطلبات (20 عملية في الساعة)، يرجى المحاولة لاحقاً',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const parentRouter = Router();

// ─── Existing Public Routes (Preserved 100%) ─────────────────────────────────

// POST /parent/lookup — no authentication required (Web Parent Portal)
parentRouter.post(
  '/lookup',
  ...parentLoginRateLimiters,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentPhone } = req.body;
      const data = await ParentService.lookupByPhone(parentPhone);
      return SuccessResponse({
        res,
        data,
        message: `تم العثور على ${data.length} طالب`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/card/:cardToken — no authentication required (QR Web scan)
parentRouter.get(
  '/card/:cardToken',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardToken } = req.params;
      const data = await CardsService.resolveByToken(cardToken as string);
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب بيانات الطالب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── New Parent Mobile Auth Routes (Public) ──────────────────────────────────

// POST /parent/auth/verify-barcode
parentRouter.post(
  '/auth/verify-barcode',
  ...parentLoginRateLimiters,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentPhone, barcode, deviceId, platform } = req.body;
      const ip = req.ip;
      const data = await ParentAuthService.verifyBarcode({
        parentPhone,
        barcode,
        deviceId: deviceId || 'unknown_device',
        platform: platform || 'android',
        ...(ip ? { ip } : {}),
      });
      return SuccessResponse({
        res,
        data,
        message: 'تم التحقق من هوية ولي الأمر بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/auth/login-phone — Direct login by phone number
parentRouter.post(
  '/auth/login-phone',
  ...parentLoginRateLimiters,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { parentPhone, deviceId, platform } = req.body;
      const ip = req.ip;
      const data = await ParentAuthService.loginByPhone({
        parentPhone,
        deviceId: deviceId || 'unknown_device',
        platform: platform || 'android',
        ...(ip ? { ip } : {}),
      });
      return SuccessResponse({
        res,
        data,
        message: 'تم تسجيل الدخول بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/auth/refresh
parentRouter.post(
  '/auth/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken, deviceId } = req.body;
      const data = await ParentAuthService.refreshSession({
        refreshToken,
        deviceId,
      });
      return SuccessResponse({
        res,
        data,
        message: 'تم تجديد الجلسة بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Protected Parent Routes (Requires Parent JWT) ───────────────────────────

// POST /parent/auth/confirm-discovered — Confirm auto-discovered children
parentRouter.post(
  '/auth/confirm-discovered',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentIds } = req.body;
      await ParentAuthService.confirmDiscovered(
        parentReq.parent.parentId,
        studentIds || [],
        parentReq.parent.deviceId
      );
      return SuccessResponse({
        res,
        message: 'تم ربط الأبناء بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/auth/logout — Device logout
parentRouter.post(
  '/auth/logout',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const deviceId = req.body.deviceId || parentReq.parent.deviceId;
      await ParentAuthService.logoutDevice(parentReq.parent.parentId, deviceId);
      return SuccessResponse({
        res,
        message: 'تم تسجيل الخروج بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/device/token — Register Push Token
parentRouter.post(
  '/device/token',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { fcmToken, platform } = req.body;
      const deviceId = req.body?.deviceId || parentReq.parent.deviceId;
      await ParentAuthService.registerPushToken(
        parentReq.parent.parentId,
        deviceId,
        fcmToken,
        platform
      );
      return SuccessResponse({
        res,
        message: 'تم تسجيل رمز الإشعارات للجهاز بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /parent/device/token — Unregister Push Token
parentRouter.delete(
  '/device/token',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const deviceId =
        req.body?.deviceId ||
        (req.query?.deviceId as string) ||
        parentReq.parent.deviceId;
      await ParentAuthService.unregisterPushToken(
        parentReq.parent.parentId,
        deviceId
      );
      return SuccessResponse({
        res,
        message: 'تم إيقاف إشعارات الجهاز بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/home — Family Overview & Child Cards
parentRouter.get(
  '/home',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const data = await ParentAppService.getFamilyOverview(
        parentReq.parent.parentId
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب ملخص العائلة بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/students/:studentId — Child Enrolled Subjects & Teachers
parentRouter.get(
  '/students/:studentId',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentId } = req.params;
      const data = await ParentAppService.getChildSubjects(
        parentReq.parent.parentId,
        studentId as string
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب تفاصيل الطالب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/students/:studentId/card — Child Digital Smart Card (QR Code)
parentRouter.get(
  '/students/:studentId/card',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentId } = req.params;
      const data = await ParentAppService.getChildCard(
        parentReq.parent.parentId,
        studentId as string
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب كارت الطالب الذكي بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/students/:studentId/attendance — Child Attendance History
parentRouter.get(
  '/students/:studentId/attendance',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentId } = req.params;
      const data = await ParentAppService.getChildAttendance(
        parentReq.parent.parentId,
        studentId as string,
        req.query as any
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب سجل الحضور بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/students/:studentId/exams — Child Exam Results
parentRouter.get(
  '/students/:studentId/exams',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentId } = req.params;
      const data = await ParentAppService.getChildExams(
        parentReq.parent.parentId,
        studentId as string,
        req.query as any
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب نتائج الامتحانات بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/students/:studentId/financial — Child Cycle & Payments
parentRouter.get(
  '/students/:studentId/financial',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { studentId } = req.params;
      const data = await ParentAppService.getChildFinancial(
        parentReq.parent.parentId,
        studentId as string,
        req.query as any
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب البيانات المالية بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/notifications — In-App Notifications
parentRouter.get(
  '/notifications',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const data = await ParentAppService.getNotifications(
        parentReq.parent.parentId,
        {
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        }
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب الإشعارات بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /parent/notifications/:id/read — Mark Notification as Read
parentRouter.patch(
  '/notifications/:id/read',
  authenticateParent,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { id } = req.params;
      await ParentAppService.markNotificationRead(
        parentReq.parent.parentId,
        id as string
      );
      return SuccessResponse({
        res,
        message: 'تم تحديث حالة الإشعار بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── Parent Inquiries & Requests Routes ──────────────────────────────────────

// GET /parent/inquiries — List parent's inquiries (optionally filtered by studentId)
parentRouter.get(
  '/inquiries',
  authenticateParent,
  validate(getParentInquiriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const data = await InquiriesService.getParentInquiries(
        parentReq.parent.parentId,
        req.query as any
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب قائمة الطلبات والاستفسارات بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /parent/inquiries/:id — Get single inquiry details
parentRouter.get(
  '/inquiries/:id',
  authenticateParent,
  validate(parentInquiryIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { id } = req.params;
      const data = await InquiriesService.getParentInquiryById(
        parentReq.parent.parentId,
        id as string
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم جلب تفاصيل الطلب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/inquiries — Create new inquiry (201 Created, or 200 on idempotent replay)
parentRouter.post(
  '/inquiries',
  authenticateParent,
  parentInquiryCreateLimiter,
  validate(createParentInquirySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { inquiry, isReplay } = await InquiriesService.createParentInquiry(
        parentReq.parent.parentId,
        req.body
      );
      return SuccessResponse({
        res,
        data: inquiry,
        message: 'تم إرسال استفسارك بنجاح وسيتم الرد عليك قريباً',
        status: isReplay ? 200 : 201,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /parent/inquiries/:id — Edit pending inquiry body (up to 3 times)
parentRouter.patch(
  '/inquiries/:id',
  authenticateParent,
  parentInquiryMutateLimiter,
  validate(updateParentInquirySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { id } = req.params;
      const data = await InquiriesService.updateParentInquiry(
        parentReq.parent.parentId,
        id as string,
        req.body.body
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم تعديل نص الطلب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /parent/inquiries/:id/cancel — Soft-cancel pending inquiry
parentRouter.post(
  '/inquiries/:id/cancel',
  authenticateParent,
  parentInquiryMutateLimiter,
  validate(parentInquiryIdParamSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parentReq = req as AuthenticatedParentRequest;
      const { id } = req.params;
      const data = await InquiriesService.cancelParentInquiry(
        parentReq.parent.parentId,
        id as string
      );
      return SuccessResponse({
        res,
        data,
        message: 'تم إلغاء الطلب بنجاح',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default parentRouter;
