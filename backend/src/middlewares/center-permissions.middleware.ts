import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../common/enums/enum.service.js';
import { ForbiddenException } from '../common/utils/response/error.responce.js';
import type { ISupervisorPermissions } from '../types/center.types.js';
import { UserModel } from '../database/models/user.model.js';
import { cache } from '../infrastructure/cache/cache.service.js';

type PermissionKey = keyof ISupervisorPermissions;

/**
 * Checks that the current user has a specific center supervisor permission.
 * - centerOwner: always passes (full access)
 * - centerSupervisor: checks the specific permission(s)
 * - all others: rejected
 */
export const requireCenterPermission = (...requiredPermissions: PermissionKey[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user) {
                throw ForbiddenException({ message: 'غير مصرح لك بالقيام بهذا الإجراء' });
            }

            // Center Owner = full access
            if (user.role === UserRole.centerOwner) {
                return next();
            }

            // Center Supervisor = check permissions
            if (user.role === UserRole.centerSupervisor) {
                // Fetch permissions (cached)
                const cacheKey = `center:perms:${user.userId}`;
                let perms = await cache.get<ISupervisorPermissions>(cacheKey);

                if (!perms) {
                    const supervisor = await UserModel.findById(user.userId)
                        .select('supervisorPermissions')
                        .lean();
                    perms = supervisor?.supervisorPermissions || null;
                    if (perms) {
                        await cache.set(cacheKey, perms, 300); // cache 5 min
                    }
                }

                if (!perms) {
                    throw ForbiddenException({ message: 'لم يتم تحديد صلاحيات لهذا المشرف' });
                }

                const hasAll = requiredPermissions.every(p => perms![p] === true);
                if (!hasAll) {
                    throw ForbiddenException({ message: 'ليس لديك الصلاحيات الكافية لهذا الإجراء' });
                }

                return next();
            }

            throw ForbiddenException({ message: 'هذا المسار خاص بإدارة السنتر فقط' });
        } catch (error) {
            next(error);
        }
    };
};
