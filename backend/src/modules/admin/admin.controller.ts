import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AdminService }    from './admin.service.js';
import { authenticate }    from '../../middlewares/auth.middleware.js';
import { authorizeRoles }  from '../../middlewares/roles.middleware.js';
import { SuccessResponse }  from '../../common/utils/response/success.responce.js';
import { NotFoundException } from '../../common/utils/response/error.responce.js';
import { UserRole } from '../../common/enums/enum.service.js';
import { ErrorLogModel } from '../../database/models/error-log.model.js';

const adminRouter = Router();

// All admin routes require authentication + superAdmin role
adminRouter.use(authenticate);
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

export default adminRouter;
