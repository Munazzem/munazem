import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../common/enums/enum.service.js';
import { ForbiddenException } from '../common/utils/response/error.responce.js';

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user) {
        throw ForbiddenException({ message: 'غير مصرح لك بالقيام بهذا الإجراء' });
      }

      if (!allowedRoles.includes(user.role)) {
        throw ForbiddenException({ message: 'ليس لديك الصلاحيات الكافية للوصول إلى هذا المسار' });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
