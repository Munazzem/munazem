import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { TeacherMessagesService } from './teacher-messages.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { UserRole } from '../../common/enums/enum.service.js';
import {
  createTeacherMessageSchema,
  teacherMessageAudienceSchema,
  getTeacherMessagesSchema,
} from '../../validation/teacher-message.validation.js';

const isTest = process.env.NODE_ENV === 'test';

export const teacherMessageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: isTest ? 1000 : 10,
  keyGenerator: (req: Request) => (req as any).user?.userId || req.ip || 'anonymous',
  message: { message: 'تجاوزت الحد المسموح لإرسال الرسائل (10 رسائل في الساعة)، يرجى المحاولة لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
});

export class TeacherMessagesController {
  static async getAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await TeacherMessagesService.getAudience(user.userId, req.query as any);
      return SuccessResponse({
        res,
        message: 'تم احتساب الجمهور المستهدف بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createTeacherMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await TeacherMessagesService.createTeacherMessage(
        user.userId,
        user.userId,
        req.body
      );
      return SuccessResponse({
        res,
        message: 'تم إرسال الرسالة لأولياء الأمور بنجاح',
        data,
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const data = await TeacherMessagesService.getTeacherMessages(
        user.userId,
        req.query as any
      );
      return SuccessResponse({
        res,
        message: 'تم جلب سجل الرسائل بنجاح',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

const router = Router();

// Restricted strictly to teachers
router.use(authenticate);
router.use(authorizeRoles(UserRole.teacher));

router.get('/audience', validate(teacherMessageAudienceSchema), TeacherMessagesController.getAudience);
router.post('/', teacherMessageLimiter, validate(createTeacherMessageSchema), TeacherMessagesController.createTeacherMessage);
router.get('/', validate(getTeacherMessagesSchema), TeacherMessagesController.getTeacherMessages);

export default router;
