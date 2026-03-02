import type { Request, Response, NextFunction } from 'express';
import { ForbiddenException } from '../common/utils/response/error.responce.js';
import { UserRole } from '../common/enums/enum.service.js';

/**
 * Tenant Isolation Middleware
 *
 * Runs after `authenticate`. Resolves the canonical teacherId for the
 * current request and attaches it as `req.tenantId`.
 *
 * Rules:
 *  - teacher  → tenantId = their own userId
 *  - assistant → tenantId = their teacherId (set at account creation)
 *  - superAdmin → tenantId = null (has cross-tenant access)
 *
 * If an assistant has no teacherId in the JWT (misconfigured account),
 * the request is rejected immediately — preventing data leakage.
 */
export const resolveTenant = (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return next();

    if (user.role === UserRole.superAdmin) {
        (req as any).tenantId = null;
        return next();
    }

    if (user.role === UserRole.teacher) {
        (req as any).tenantId = user.userId;
        return next();
    }

    if (user.role === UserRole.assistant) {
        if (!user.teacherId) {
            return next(ForbiddenException({
                message: 'حساب المساعد غير مرتبط بمعلم — تواصل مع الإدارة'
            }));
        }
        (req as any).tenantId = user.teacherId;
        return next();
    }

    return next(ForbiddenException({ message: 'دور غير معروف' }));
};

/**
 * Helper used inside service functions.
 * Throws immediately if the requested resource's teacherId doesn't match
 * the current tenant — second line of defense after DB-level filtering.
 */
export const assertTenant = (resourceTeacherId: string, tenantId: string | null) => {
    if (tenantId === null) return; // superAdmin — skip check
    if (resourceTeacherId.toString() !== tenantId.toString()) {
        throw ForbiddenException({ message: 'ليس لديك صلاحية الوصول لهذا المورد' });
    }
};
