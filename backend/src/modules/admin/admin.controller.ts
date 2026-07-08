import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AdminService }    from './admin.service.js';
import { authenticate }    from '../../middlewares/auth.middleware.js';
import { authorizeRoles }  from '../../middlewares/roles.middleware.js';
import { SuccessResponse }  from '../../common/utils/response/success.responce.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { ErrorLogModel } from '../../database/models/error-log.model.js';
import { SubscriptionService } from '../subscriptions/subscriptions.service.js';

import { generateWeeklyReports, generatePaymentReminders } from './../automation/automation.service.js';

const adminRouter = Router();

// ── GET /admin/test-automation ───────────────────────────────────────
// Temporary endpoint to trigger automation locally without waiting for cron.
adminRouter.post('/test-automation', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, teacherId } = req.body;
        if (type === 'weekly_report') await generateWeeklyReports(teacherId, true);
        else if (type === 'payment_reminder') await generatePaymentReminders(teacherId);
        else return next(new Error('Invalid type. Use "weekly_report" or "payment_reminder"'));
        
        return SuccessResponse({ res, data: null, message: `Automation ${type} triggered successfully` });
    } catch (error) { next(error); }
});

// All admin routes require authentication
adminRouter.use(authenticate);

// ── Public (any authenticated user) ────────────────────────────────
// Active announcements are displayed to ALL users (teachers, assistants, superAdmin)
adminRouter.get('/announcements/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getActiveAnnouncements();
        return SuccessResponse({ res, data, message: 'تم استرجاع الإشعارات النشطة' });
    } catch (error) { next(error); }
});

// Everything below requires superAdmin role
adminRouter.use(authorizeRoles(UserRole.superAdmin));

// ── GET /admin/stats ─────────────────────────────────────────────────
adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getOverviewStats();
        return SuccessResponse({ res, data, message: 'Platform stats fetched successfully' });
    } catch (error) { next(error); }
});

// ── GET /admin/growth ────────────────────────────────────────────────
adminRouter.get('/growth', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getGrowthData();
        return SuccessResponse({ res, data, message: 'Growth data fetched successfully' });
    } catch (error) { next(error); }
});

// ── GET /admin/tenants ───────────────────────────────────────────────
adminRouter.get('/tenants', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, search, status } = req.query as Record<string, string>;
        const data = await AdminService.getAllTenants({
            page:  page  ? parseInt(page)  : 1,
            limit: limit ? parseInt(limit) : 20,
            ...(search ? { search } : {}),
            ...(status ? { status } : {}),
        });
        return SuccessResponse({ res, data, message: 'Tenants fetched successfully' });
    } catch (error) { next(error); }
});

// ── GET /admin/tenants/:id ───────────────────────────────────────────
adminRouter.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getTenantDetail(req.params['id'] as string);
        if (!data) throw NotFoundException({ message: 'Teacher not found' });
        return SuccessResponse({ res, data, message: 'Tenant detail fetched successfully' });
    } catch (error) { next(error); }
});

// ── PATCH /admin/tenants/:id ─────────────────────────────────────────
adminRouter.patch('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.updateTenant(req.params['id'] as string, req.body);
        return SuccessResponse({ res, data, message: 'Teacher updated successfully' });
    } catch (error) { next(error); }
});

// ── POST /admin/tenants/:id/suspend ─────────────────────────────────
adminRouter.post('/tenants/:id/suspend', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.setTenantStatus(req.params['id'] as string, false);
        if (!data) throw NotFoundException({ message: 'Teacher not found' });
        return SuccessResponse({ res, data, message: 'Account suspended successfully' });
    } catch (error) { next(error); }
});

// ── POST /admin/tenants/:id/activate ────────────────────────────────
adminRouter.post('/tenants/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.setTenantStatus(req.params['id'] as string, true);
        if (!data) throw NotFoundException({ message: 'Teacher not found' });
        return SuccessResponse({ res, data, message: 'Account activated successfully' });
    } catch (error) { next(error); }
});

// ── POST /admin/tenants/:id/subscription ────────────────────────────
adminRouter.post('/tenants/:id/subscription', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { planTier, durationMonths, studentsCount, paymentMethod, promoCode } = req.body;
        const data = await SubscriptionService.createSubscription(req.params['id'] as string, { planTier, durationMonths, studentsCount, paymentMethod, promoCode });
        return SuccessResponse({ res, data, message: 'تم إضافة الاشتراك بنجاح' });
    } catch (error) { next(error); }
});

// ── GET /admin/errors ────────────────────────────────────────────────
adminRouter.get('/errors', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, level } = req.query as Record<string, string>;
        const data = await AdminService.getRecentErrors({
            page:  page  ? parseInt(page)  : 1,
            limit: limit ? parseInt(limit) : 50,
            ...(level ? { level } : {}),
        });
        return SuccessResponse({ res, data, message: 'Error logs fetched successfully' });
    } catch (error) { next(error); }
});

// ── GET /admin/activity ─────────────────────────────────────────────
adminRouter.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, event, tenantId } = req.query as Record<string, string>;
        const data = await AdminService.getActivityFeed({
            page:  page  ? parseInt(page)  : 1,
            limit: limit ? parseInt(limit) : 20,
            ...(event    ? { event }    : {}),
            ...(tenantId ? { tenantId } : {}),
        });
        return SuccessResponse({ res, data, message: 'Activity feed fetched successfully' });
    } catch (error) { next(error); }
});

// ── GET /admin/health ─────────────────────────────────────────────
 adminRouter.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const mem    = process.memoryUsage();
        const uptime = Math.floor(process.uptime());

        // Error rate: last hour
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentErrors = await ErrorLogModel.countDocuments({ createdAt: { $gte: hourAgo } });

        // Total errors last 24h
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const last24hErrors = await ErrorLogModel.countDocuments({ createdAt: { $gte: dayAgo } });

        return SuccessResponse({
            res,
            data: {
                status:   'ok',
                uptime,
                uptimeHuman: formatUptime(uptime),
                memory: {
                    heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
                    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                    rssMB:       Math.round(mem.rss       / 1024 / 1024),
                    heapPct:     Math.round((mem.heapUsed / mem.heapTotal) * 100),
                },
                errors: {
                    lastHour: recentErrors,
                    last24h:  last24hErrors,
                },
                timestamp: new Date().toISOString(),
            },
            message: 'Server health OK',
        });
    } catch (error) { next(error); }
});

function formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} يوم ${h} ساعة`;
    if (h > 0) return `${h} ساعة ${m} دقيقة`;
    return `${m} دقيقة`;
}

// ── GET /admin/platform-settings ──────────────────────────────────────
adminRouter.get('/platform-settings', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getPlatformSettings();
        return SuccessResponse({ res, data, message: 'Platform settings fetched successfully' });
    } catch (error) { next(error); }
});

// ── PATCH /admin/platform-settings/plan-prices ──────────────────────
adminRouter.patch('/platform-settings/plan-prices', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prices } = req.body;
        const data = await AdminService.updatePlanPrices(prices);
        return SuccessResponse({ res, data, message: 'Plan prices updated successfully' });
    } catch (error) { next(error); }
});


// ── GET /admin/promo-codes ──────────────────────────────────────────
adminRouter.get('/promo-codes', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getPromoCodes();
        return SuccessResponse({ res, data, message: 'تم استرجاع أكواد الخصم' });
    } catch (error) { next(error); }
});

// ── POST /admin/promo-codes ─────────────────────────────────────────
adminRouter.post('/promo-codes', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.createPromoCode(req.body);
        return SuccessResponse({ res, data, message: 'تم إنشاء كود الخصم بنجاح' });
    } catch (error) { next(error); }
});

// ── PATCH /admin/promo-codes/:id/toggle ─────────────────────────────
adminRouter.patch('/promo-codes/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.togglePromoCode(req.params['id'] as string);
        return SuccessResponse({ res, data, message: 'تم تغيير حالة كود الخصم' });
    } catch (error) { next(error); }
});

// ── DELETE /admin/promo-codes/:id ───────────────────────────────────
adminRouter.delete('/promo-codes/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AdminService.deletePromoCode(req.params['id'] as string);
        return SuccessResponse({ res, message: 'تم حذف كود الخصم بنجاح' });
    } catch (error) { next(error); }
});

// ── Announcements ──────────────────────────────────────────────────────

adminRouter.get('/announcements', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.getAnnouncements();
        return SuccessResponse({ res, data, message: 'تم استرجاع الإشعارات' });
    } catch (error) { next(error); }
});


adminRouter.post('/announcements', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.createAnnouncement(req.body);
        return SuccessResponse({ res, data, message: 'تم إنشاء الإشعار بنجاح' });
    } catch (error) { next(error); }
});

adminRouter.patch('/announcements/:id/toggle', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await AdminService.toggleAnnouncement(req.params['id'] as string);
        return SuccessResponse({ res, data, message: 'تم تحديث حالة الإشعار' });
    } catch (error) { next(error); }
});

adminRouter.delete('/announcements/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await AdminService.deleteAnnouncement(req.params['id'] as string);
        return SuccessResponse({ res, message: 'تم حذف الإشعار بنجاح' });
    } catch (error) { next(error); }
});

export default adminRouter;
