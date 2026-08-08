import express from 'express';
import { createServer } from 'http';
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
import cardsRouter  from './modules/cards/cards.controller.js';
import { startWhatsAppWorker }    from './infrastructure/queues/whatsapp.processor.js';
import { startEmailWorker }       from './infrastructure/queues/email.processor.js';
import { autoReconnectClients }   from './common/utils/whatsapp.service.js';
import { startAutomationScheduler } from './infrastructure/schedulers/automation.scheduler.js';
import { initWhatsAppGateway }    from './infrastructure/socket/whatsapp.gateway.js';

// createApp: pure Express factory (no DB, no workers, no listen).
// Used by supertest in integration tests.
// bootstrap() calls this after starting DB and background workers.
export function createApp() {
    const app = express();

    // Trust the reverse proxy (e.g. Render, Nginx, Vercel) to get the real user IP
    app.set('trust proxy', 1);

    app.use(helmet());
    app.use(express.json());
    const allowedOrigins = envVars.frontendUrl
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    }));

    app.use((req: any, _res: any, next: any) => {
        if (req.body)   mongoSanitize.sanitize(req.body);
        if (req.params) mongoSanitize.sanitize(req.params);
        next();
    });

    app.use(compression());

    app.use((req: any, res: any, next: any) => {
        const timeout = req.path.includes('/exams/ai/') ? 120_000 : 30_000;
        res.setTimeout(timeout, () => {
            res.status(503).json({ message: 'انتهت مهلة الطلب، يرجى المحاولة مرة أخرى' });
        });
        next();
    });

    app.use((req: any, _res: any, next: any) => {
        req.requestId = generateRequestId();
        next();
    });

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

    const isTest = process.env.NODE_ENV === 'test';
    const globalLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: isTest ? 30000 : 3000,
        message: { message: 'كثرة الطلبات، يرجى المحاولة لاحقاً' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(globalLimiter);

    const aiLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: isTest ? 1000 : 3,
        message: { message: 'تجاوزت حد توليد الامتحانات بالذكاء الاصطناعي، انتظر دقيقة' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use('/exams/ai/generate', aiLimiter);
    app.use('/exams/ai-proxy', aiLimiter);

    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: isTest ? 100 : 10,
        message: { message: 'كثرة محاولات تسجيل الدخول، يرجى المحاولة مرة أخرى بعد 15 دقيقة' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/auth/login', loginLimiter);
    app.use('/auth', authRouter);
    app.use('/parent', parentRouter);
    app.use(resolveTenant);
    app.use('/users', userRouter);
    app.use('/subscriptions', subscriptionsRouter);
    app.use('/groups', groupsRouter);
    app.use('/students', studentsRouter);
    app.use('/sessions', sessionRouter);
    app.use('/attendance', attendanceRouter);
    app.use('/payments', paymentsRouter);
    app.use('/notebooks', notebooksRouter);
    app.use('/reports', reportsRouter);
    app.use('/exams', examsRouter);
    app.use('/exams/ai-proxy', aiProxyRouter);
    app.use('/whatsapp', whatsappRouter);
    app.use('/admin', adminRouter);
    app.use('/cards', cardsRouter);

    app.get('/health', (_req, res) => {
        const mem = process.memoryUsage();
        res.status(200).json({
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            memory: {
                heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
                rssMB:       Math.round(mem.rss       / 1024 / 1024),
            },
            os: {
                loadAvg:    os.loadavg().map(l => Math.round(l * 100) / 100),
                freeMemMB:  Math.round(os.freemem()  / 1024 / 1024),
                totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
            },
        });
    });

    app.get('/', (_req, res) => {
        res.status(200).json({ status: 'ok', message: 'Monazem API is running' });
    });

    app.use('{*dummy}', (_req, res) => {
        res.status(404).json('Page not found');
    });

    app.use(globalErrorHandler);

    return app;
}

// bootstrap: production entry point.
// Connects DB, starts workers, attaches socket.io, starts listening.
// Behavior is identical to before the createApp() extraction.
export const bootstrap = async () => {
    await DBConnection();

    // Background workers
    autoReconnectClients();
    startWhatsAppWorker();
    startEmailWorker();
    startAutomationScheduler();

    const app = createApp();

    // Attach Socket.io to the HTTP server
    const server = createServer(app);
    initWhatsAppGateway(server);

    server.listen(envVars.port, () => {
        console.log(`Server running on http://localhost:${envVars.port}`);
    });
};
