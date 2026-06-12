import express from 'express';
import os from 'os';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { DBConnection } from './database/connection.js';
import { globalErrorHandler } from './common/utils/response/error.responce.js';
import { envVars } from '../config/env.service.js';
import { logger, generateRequestId } from './common/utils/logger.util.js';
import { resolveTenant } from './middlewares/tenant.middleware.js';
import authRouter from './modules/authentication/auth.controller.js';
import userRouter from './modules/users/users.controller.js';
import subscriptionsRouter from './modules/subscriptions/subscriptions.controller.js';
import groupsRouter from './modules/groups/groups.controller.js';
import studentsRouter from './modules/students/students.controller.js';
import sessionRouter from './modules/sessions/sessions.controller.js';
import attendanceRouter from './modules/attendance/attendance.controller.js';
import paymentsRouter from './modules/payments/payments.controller.js';
import notebooksRouter from './modules/notebooks/notebooks.controller.js';
import reportsRouter from './modules/reports/reports.controller.js';
import examsRouter, { aiProxyRouter }  from './modules/exams/exams.controller.js';
import parentRouter from './modules/parent/parent.controller.js';
import adminRouter  from './modules/admin/admin.controller.js';
import whatsappRouter from './modules/whatsapp/whatsapp.controller.js';
import { startWhatsAppWorker }    from './infrastructure/queues/whatsapp.processor.js';
import { autoReconnectClients }   from './common/utils/whatsapp.service.js';
import { startAutomationScheduler } from './infrastructure/schedulers/automation.scheduler.js';

export const bootstrap = async () => {
    const app = express();
    
    // Trust the reverse proxy (e.g. Render, Nginx, Vercel) to get the real user IP
    // Without this, all requests will look like they come from the load balancer's IP!
    app.set('trust proxy', 1);

    app.use(helmet());
    app.use(express.json());
    const allowedOrigins = envVars.frontendUrl
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    app.use(cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (Postman, mobile apps, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    }));
    // Express 5 makes req.query a read-only getter, so we cannot use mongoSanitize() middleware directly.
    // Instead we manually sanitize body and params (query strings never carry $ operators from the frontend).
    app.use((req: any, _res: any, next: any) => {
        if (req.body)   mongoSanitize.sanitize(req.body);
        if (req.params) mongoSanitize.sanitize(req.params);
        next();
    });

    app.use(compression());

    // Request timeout: 30s for normal requests, 120s for AI generation
    app.use((req: any, res: any, next: any) => {
        const timeout = req.path.includes('/exams/ai/') ? 120_000 : 30_000;
        res.setTimeout(timeout, () => {
            res.status(503).json({ message: 'انتهت مهلة الطلب، يرجى المحاولة مرة أخرى' });
        });
        next();
    });

    // Attach a unique requestId to every incoming request — used for log correlation
    app.use((req: any, _res: any, next: any) => {
        req.requestId = generateRequestId();
        next();
    });

    // Lightweight request logging — after basic security & timeouts
    app.use((req: any, res: any, next: any) => {
        const start = process.hrtime.bigint();

        res.on('finish', () => {
            const end = process.hrtime.bigint();
            const durationMs = Number(end - start) / 1_000_000;
            const user = (req as any).user;

            logger.info('request_completed', {
                requestId:  req.requestId,
                method:     req.method,
                path:       req.path,
                statusCode: res.statusCode,
                durationMs: Math.round(durationMs),
                userId:     user?.userId ?? null,
                role:       user?.role   ?? null,
            });

            // Slow query warning — helps catch performance regressions early
            if (durationMs > 3000) {
                logger.warn('slow_request', {
                    requestId:  req.requestId,
                    method:     req.method,
                    path:       req.path,
                    durationMs: Math.round(durationMs),
                    userId:     user?.userId ?? null,
                });
            }
        });

        next();
    });

    await DBConnection();

    // ── Background workers ────────────────────────────────────────────────────
    // 1. Re-connect WhatsApp clients for all previously-connected teachers (fire-and-forget)
    autoReconnectClients();
    // 2. Start the BullMQ worker that drains the whatsapp queue
    startWhatsAppWorker();
    // 3. Start the automation scheduler (weekly reports, daily reminders, weekly archival)
    startAutomationScheduler();

    // Global rate limiter: 3000 requests per 15 minutes per IP
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 3000,
        message: { message: 'كثرة الطلبات، يرجى المحاولة لاحقاً' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(globalLimiter);

    // Strict limiter for AI exam generation: 3 requests per minute per IP
    const aiLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 3,
        message: { message: 'تجاوزت حد توليد الامتحانات بالذكاء الاصطناعي، انتظر دقيقة' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/exams/ai/generate', aiLimiter);
    app.use('/exams/ai-proxy', aiLimiter);

    // Rate limit: max 10 login attempts per 15 minutes per IP
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        message: { message: 'كثرة محاولات تسجيل الدخول، يرجى المحاولة مرة أخرى بعد 15 دقيقة' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/auth/login', loginLimiter);
    app.use('/auth', authRouter)          // Authentication routes

    // Parent portal — public, no authentication required
    app.use('/parent', parentRouter);

    // Tenant isolation — runs after authenticate inside each router
    // Resolves req.tenantId for all subsequent protected routes
    app.use(resolveTenant);

    app.use('/users', userRouter)          // Users routes
    app.use('/subscriptions', subscriptionsRouter) // Subscriptions routes
    app.use('/groups', groupsRouter)
    app.use('/students', studentsRouter)
    app.use('/sessions', sessionRouter)      // Session routes
    app.use('/attendance', attendanceRouter)  // Attendance routes
    app.use('/payments', paymentsRouter)      // Payments routes
    app.use('/notebooks', notebooksRouter)    // Notebooks inventory routes
    app.use('/reports', reportsRouter)         // Reports routes
    app.use('/exams', examsRouter)              // Exams + AI Generation routes
    app.use('/exams/ai-proxy', aiProxyRouter)   // AI proxy (lightweight — text only)
    app.use('/whatsapp', whatsappRouter)          // WhatsApp multi-tenant client mgmt
    app.use('/admin', adminRouter)              // Super Admin routes

    // Health check — used by Render to verify the server is alive; includes basic process stats for monitoring
    app.get('/health', (_req, res) => {
        const mem = process.memoryUsage();
        res.status(200).json({
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            memory: {
                heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                rssMB: Math.round(mem.rss / 1024 / 1024),
            },
            os: {
                loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100),
                freeMemMB: Math.round(os.freemem() / 1024 / 1024),
                totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
            },
        });
    });

    app.get('/', (_req, res) => {
        res.status(200).json({ status: 'ok', message: 'Monazem API is running' });
    });

    app.use('{*dummy}', (req, res) => {
        res.status(404).json('Page not found');
    }); // check if the route is valid or not

    app.use(globalErrorHandler) // Global error handling middleware

    app.listen(envVars.port, () => {
        console.log(`Server running on http://localhost:${envVars.port}`);
    });
}
