import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { InquiriesService } from './inquiries.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { resolveTenant } from '../../middlewares/tenant.middleware.js';
import { requireAssistantPermission } from '../../middlewares/assistant-permissions.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import {
  getStaffInquiriesSchema,
  staffInquiryIdParamSchema,
  replyInquirySchema,
  escalateInquirySchema,
} from '../../validation/parent-inquiry.validation.js';

const isTest = process.env.NODE_ENV === 'test';

// Rate Limit S5: 60 replies per hour per staff userId
export const staffInquiryReplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 1000 : 60,
  keyGenerator: (req: Request) =>
    (req as any).user?.userId || req.ip || 'anonymous',
  message: {
    message:
      'تجاوزت الحد المسموح للردود (60 رداً في الساعة)، يرجى المحاولة لاحقاً',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export class InquiriesController {
  static async getStaffInquiries(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantId = (req as any).tenantId;
      const data = await InquiriesService.getStaffInquiries(
        tenantId,
        req.query as any
      );
      return SuccessResponse({
        res,
        message: 'تم جلب قائمة الاستفسارات بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStaffInquiryCounts(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantId = (req as any).tenantId;
      const data = await InquiriesService.getStaffInquiryCounts(tenantId);
      return SuccessResponse({
        res,
        message: 'تم جلب عدادات الاستفسارات بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStaffInquiryById(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;
      const data = await InquiriesService.getStaffInquiryById(
        tenantId,
        id as string
      );
      return SuccessResponse({
        res,
        message: 'تم جلب تفاصيل الاستفسار بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async replyToInquiry(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantId = (req as any).tenantId;
      const user = (req as any).user;
      const { id } = req.params;
      const { body, clientRequestId, expectedEditCount } = req.body;

      const { inquiry } = await InquiriesService.replyToInquiry({
        tenantId,
        inquiryId: id as string,
        userId: user.userId,
        userRole: user.role,
        body,
        clientRequestId,
        expectedEditCount,
      });

      return SuccessResponse({
        res,
        message: 'تم إرسال الرد بنجاح',
        data: inquiry,
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  }

  static async escalateInquiry(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const tenantId = (req as any).tenantId;
      const user = (req as any).user;
      const { id } = req.params;
      const { note } = req.body || {};

      const data = await InquiriesService.escalateInquiry({
        tenantId,
        inquiryId: id as string,
        userId: user.userId,
        note,
      });

      return SuccessResponse({
        res,
        message: 'تم تحويل الطلب للمعلم بنجاح',
        data,
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  }
}

const router = Router();

// Security A4: Strict Teacher & Assistant chain with tenant isolation & permission check
router.use(authenticate);
router.use(authorizeRoles(UserRole.teacher, UserRole.assistant));
router.use(resolveTenant);
router.use(requireAssistantPermission('canManageInquiries'));

router.get(
  '/counts',
  InquiriesController.getStaffInquiryCounts
);
router.get(
  '/',
  validate(getStaffInquiriesSchema),
  InquiriesController.getStaffInquiries
);
router.get(
  '/:id',
  validate(staffInquiryIdParamSchema),
  InquiriesController.getStaffInquiryById
);
router.post(
  '/:id/reply',
  staffInquiryReplyLimiter,
  validate(replyInquirySchema),
  InquiriesController.replyToInquiry
);
router.post(
  '/:id/escalate',
  validate(escalateInquirySchema),
  InquiriesController.escalateInquiry
);

export default router;
