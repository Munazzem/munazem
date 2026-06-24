import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '../common/enums/enum.service.js';
export declare const authorizeRoles: (...allowedRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=roles.middleware.d.ts.map