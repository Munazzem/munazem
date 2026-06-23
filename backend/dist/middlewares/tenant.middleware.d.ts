import type { Request, Response, NextFunction } from 'express';
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
export declare const resolveTenant: (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Helper used inside service functions.
 * Throws immediately if the requested resource's teacherId doesn't match
 * the current tenant — second line of defense after DB-level filtering.
 */
export declare const assertTenant: (resourceTeacherId: string, tenantId: string | null) => void;
//# sourceMappingURL=tenant.middleware.d.ts.map