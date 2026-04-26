import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ReportsService } from './reports.service.js';
import { PdfService } from './pdf.service.js';
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

// ─── GET /reports/daily-summary — End-of-day recap for teacher & assistant
reportsRouter.get(
    '/daily-summary',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = user.role === UserRole.assistant ? user.teacherId : user.userId;
            const date = req.query['date'] as string | undefined;
            const data = await ReportsService.getDailySummary(teacherId, date);
            return SuccessResponse({ res, data, message: 'تم جلب ملخص اليوم' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/daily-summary/pdf — End-of-day recap PDF
reportsRouter.get(
    '/daily-summary/pdf',
    authorizeRoles(UserRole.teacher, UserRole.assistant),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = (req as any).user;
            const teacherId = user.role === UserRole.assistant ? user.teacherId : user.userId;
            const date = req.query['date'] as string | undefined;
            const htmlString = await PdfService.generateDailySummaryPdf(teacherId, date);
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
            });
            res.send(htmlString);
        } catch (error) { next(error); }
    }
);

// All remaining routes: Teacher + Assistant (full access)
reportsRouter.use(authorizeRoles(UserRole.teacher, UserRole.assistant));

// Helper — resolves teacherId for both teacher and assistant
const resolveTeacherId = (user: any): string =>
    user.role === UserRole.assistant ? user.teacherId : user.userId;

// ─── GET /reports/student/:studentId — Full student report
reportsRouter.get(
    '/student/:studentId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const data = await ReportsService.getStudentReport(
                req.params['studentId'] as string, teacherId
            );
            return SuccessResponse({ res, data, message: 'تم جلب تقرير الطالب بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/student/:studentId/pdf — Download PDF Report
reportsRouter.get(
    '/student/:studentId/pdf',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const htmlString = await PdfService.generateStudentReportPdf(
                req.params['studentId'] as string, teacherId
            );
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
            });
            res.send(htmlString);
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/group/:groupId — Group attendance + revenue report
reportsRouter.get(
    '/group/:groupId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const data = await ReportsService.getGroupReport(
                req.params['groupId'] as string, teacherId
            );
            return SuccessResponse({ res, data, message: 'تم جلب تقرير المجموعة بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/group/:groupId/pdf — Download Group Report PDF
reportsRouter.get(
    '/group/:groupId/pdf',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const htmlString = await PdfService.generateGroupReportPdf(
                req.params['groupId'] as string, teacherId
            );
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
            });
            res.send(htmlString);
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/group/:groupId/attendance-sheet — Download Group Attendance Sheet
reportsRouter.get(
    '/group/:groupId/attendance-sheet',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const htmlString = await PdfService.generateGroupAttendanceSheetHtml(
                req.params['groupId'] as string, teacherId
            );
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
            });
            res.send(htmlString);
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/financial/monthly?year=2026&month=2 — Monthly financial report
reportsRouter.get(
    '/financial/monthly',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const now   = new Date();
            const year  = parseInt(req.query['year']  as string) || now.getUTCFullYear();
            const month = parseInt(req.query['month'] as string) || (now.getUTCMonth() + 1);
            const data = await ReportsService.getFinancialMonthlyReport(teacherId, year, month);
            return SuccessResponse({ res, data, message: 'تم جلب التقرير المالي الشهري بنجاح' });
        } catch (error) { next(error); }
    }
);

// ─── GET /reports/financial/monthly/pdf?year=2026&month=2 — Monthly financial report PDF
reportsRouter.get(
    '/financial/monthly/pdf',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const teacherId = resolveTeacherId((req as any).user);
            const now   = new Date();
            const year  = parseInt(req.query['year']  as string) || now.getUTCFullYear();
            const month = parseInt(req.query['month'] as string) || (now.getUTCMonth() + 1);
            const htmlString = await PdfService.generateMonthlyFinancialPdf(teacherId, year, month);
            res.set({
                'Content-Type': 'text/html; charset=utf-8',
            });
            res.send(htmlString);
        } catch (error) { next(error); }
    }
);

export default reportsRouter;
