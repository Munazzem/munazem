import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { DBConnection } from './database/connection.js';
import { globalErrorHandler } from './common/utils/response/error.responce.js';
import { envVars } from '../config/env.service.js';
import authRouter from './modules/authentication/auth.controller.js';
import userRouter from './modules/users/users.controller.js';
import subscriptionsRouter from './modules/subscriptions/subscriptions.controller.js';
import groupsRouter from './modules/groups/groups.controller.js';
import studentsRouter from './modules/students/students.controller.js';

export const bootstrap = () => {
    const app = express();
    app.use(express.json());
    app.use(cors());

    // Enable gzip compression for all HTTP responses to reduce payload size and improve latency.
    app.use(compression());

    DBConnection() // Connect to MongoDB

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
    app.use('/users', userRouter)          // Users routes
    app.use('/subscriptions', subscriptionsRouter) // Subscriptions routes
    app.use('/groups', groupsRouter)
    app.use('/students', studentsRouter)

    app.get('/', (req, res) => {
        res.send('Hello World!');
    });

    app.use('{*dummy}', (req, res) => {
        res.status(404).json('Page not found');
    }); // check if the route is valid or not

    app.use(globalErrorHandler) // Global error handling middleware

    app.listen(envVars.port, () => {
        console.log(`Server running on http://localhost:${envVars.port}`);
    });
}
