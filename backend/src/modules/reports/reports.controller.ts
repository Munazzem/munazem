import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { SuccessResponse } from '../../common/utils/response/success.responce.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/roles.middleware.js';

const reportsRouter = Router();

// All reports require authentication
reportsRouter.use(authenticate);

// All reports: Teacher only by default (read-only data, high-level access)
// Exception: Dashboard is accessible to assistants too (they get a stripped-down version)
// So we apply the global authorizeRoles(UserRole.teacher) lower down, NOT globally.

// ─── GET /reports/dashboard — Home page quick stats
reportsRouter.get(
    '/dashboard',
    authorizeRoles(UserRole.teacher, UserRole.assistant), // Allow Assistant
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = user.role === UserRole.assistant ? user.teacherId : user.userId;
            const data = await ReportsService.getDashboardSummary(teacherId, user.role);
            return SuccessResponse({ res, data, message: 'تم جلب ملخص لوحة التحكم' });
        } catch (error) { next(error); }
    }
);

// Apply Teacher-only restriction for the rest of the deeper financial/attendance reports
reportsRouter.use(authorizeRoles(UserRole.teacher));

// ─── GET /reports/student/:studentId — Full student report
reportsRouter.get(
    '/student/:studentId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const data = await ReportsService.getStudentReport(
                req.params['studentId'] as string, teacherId
            );
            return SuccessResponse({ res, data, message: 'تم جلب تقرير الطالب بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/group/:groupId — Group attendance + revenue report
reportsRouter.get(
    '/group/:groupId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const data = await ReportsService.getGroupReport(
                req.params['groupId'] as string, teacherId
            );
            return SuccessResponse({ res, data, message: 'تم جلب تقرير المجموعة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/financial/monthly?year=2026&month=2 — Monthly financial report
reportsRouter.get(
    '/financial/monthly',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = (req as any).user.userId;
            const now   = new Date();
            const year  = parseInt(req.query['year']  as string) || now.getUTCFullYear();
            const month = parseInt(req.query['month'] as string) || (now.getUTCMonth() + 1);
            const data = await ReportsService.getFinancialMonthlyReport(teacherId, year, month);
            return SuccessResponse({ res, data, message: 'تم جلب التقرير المالي الشهري بنجاح' });
        } catch (error) { next(error); }
    }
);

export default reportsRouter;
