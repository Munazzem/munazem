import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../common/enums/enum.service.js';
import { ForbiddenException } from '../common/utils/response/error.responce.js';
import type { IAssistantPermissions } from '../types/user.types.js';
import { UserModel } from '../database/models/user.model.js';
import { cache } from '../infrastructure/cache/cache.service.js';

type AssistantPermissionKey = keyof IAssistantPermissions;

/**
 * Checks that the current user has a specific assistant permission.
 * - teacher / superAdmin: always passes (full access)
 * - assistant: checks the specific permission(s)
 * - others: passes or rejects based on role
 */
export const requireAssistantPermission = (...requiredPermissions: AssistantPermissionKey[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;

            if (!user) {
                throw ForbiddenException({ message: 'غير مصرح لك بالقيام بهذا الإجراء' });
            }

            // Teachers & SuperAdmin always have full access
            if (user.role === UserRole.teacher || user.role === UserRole.superAdmin || user.role === 'SUPER_ADMIN') {
                return next();
            }

            // Assistant: check permissions
            if (user.role === UserRole.assistant) {
                const cacheKey = `assistant:perms:${user.userId}`;
                let perms = await cache.get<IAssistantPermissions>(cacheKey);

                if (!perms) {
                    const assistant = await UserModel.findById(user.userId)
                        .select('assistantPermissions')
                        .lean();
                    perms = assistant?.assistantPermissions || null;
                    if (perms) {
                        await cache.set(cacheKey, perms, 300); // 5 min cache
                    }
                }

                if (!perms) {
                    throw ForbiddenException({ message: 'لم يتم تحديد صلاحيات لهذا المساعد' });
                }

                const hasAll = requiredPermissions.every((p) => perms![p] === true);
                if (!hasAll) {
                    throw ForbiddenException({ message: 'ليس لديك الصلاحيات الكافية لهذا الإجراء' });
                }

                return next();
            }

            return next();
        } catch (error) {
            next(error);
        }
    };
};
