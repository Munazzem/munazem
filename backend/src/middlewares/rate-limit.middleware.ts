import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';

const isTest = process.env.NODE_ENV === 'test';

/**
 * ─── Rate Limiter for Parent Authentication ─────────────────────────────────
 * Specifically targets repeated failed login attempts with wrong phone numbers
 * or invalid barcodes in the Parent Mobile App & Portal.
 *
 * Rules:
 * - Successful attempts (status < 400) do NOT count (skipSuccessfulRequests: true).
 * - Only failed attempts (404 Not Found, 400 Bad Request, etc.) increment the counter.
 * - Max 5 failed attempts per device (or per IP if no deviceId) within 15 minutes.
 * - IP ceiling limit: max 20 failed attempts per IP within 15 minutes (protects against bots).
 */

export const parentAuthDeviceLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isTest ? 100 : 5, // 5 failed attempts per window
    skipSuccessfulRequests: true, // Only count failures (wrong number / barcode)
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
        const clientIp = ipKeyGenerator(req.ip || '127.0.0.1');
        const deviceId = req.body?.deviceId ? String(req.body.deviceId).trim() : '';
        return deviceId ? `${clientIp}_${deviceId}` : clientIp;
    },
    handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
        const retryAfterMinutes = Math.ceil(options.windowMs / (60 * 1000));
        return res.status(429).json({
            success: false,
            message: `تم تجاوز الحد المسموح به لمحاولات الدخول الخاطئة (5 محاولات). يرجى الانتظار ${retryAfterMinutes} دقيقة قبل المحاولة مرة أخرى أو مراجعة إدارة السنتر.`,
        });
    },
});

export const parentAuthIpCeilingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isTest ? 500 : 20, // 20 failed attempts per IP
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip || '127.0.0.1'),
    handler: (req: Request, res: Response, _next: NextFunction, options: any) => {
        const retryAfterMinutes = Math.ceil(options.windowMs / (60 * 1000));
        return res.status(429).json({
            success: false,
            message: `تم حظر هذا الاتصال مؤقتاً لكثرة المحاولات غير الصحيحة. يرجى الانتظار ${retryAfterMinutes} دقيقة والمحاولة لاحقاً.`,
        });
    },
});

export const parentLoginRateLimiters = [parentAuthIpCeilingLimiter, parentAuthDeviceLimiter];
