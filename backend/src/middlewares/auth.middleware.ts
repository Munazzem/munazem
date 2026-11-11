import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedException } from '../common/utils/response/error.responce.js';
import { TokenUtil } from '../common/utils/token.util.js';
import type { IJwtPayload } from '../types/auth.types.js';
import { cache, CacheKeys, CacheTTL } from '../infrastructure/cache/cache.service.js';
import { UserModel } from '../database/models/user.model.js';
import { PresenceService } from '../infrastructure/presence/presence.service.js';

// Threshold: issue fresh token if less than 5 minutes remain
const SLIDING_THRESHOLD_SECONDS = 5 * 60;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1] as string;
    } else if (req.query.token && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      throw UnauthorizedException({ message: 'الرجاء تسجيل الدخول للوصول إلى هذا المسار' });
    }

    // Verify token signature and expiration — no DB call needed
    const payload = TokenUtil.verifyAccessToken(token) as IJwtPayload;

    // isActive is embedded in the JWT payload — zero DB cost
    if (!payload.isActive) {
      throw UnauthorizedException({ message: 'تم إيقاف هذا الحساب، يرجى مراجعة الإدارة' });
    }

    // ── Assistant Kill Switch Check ──────────────────────────────────────
    if (payload.role === 'assistant' && payload.teacherId) {
      const cacheKey = CacheKeys.assistantsAccess(payload.teacherId);
      let isAccessEnabled = await cache.get<boolean>(cacheKey);

      if (isAccessEnabled === null) {
        // Cache miss -> fetch from DB
        const teacher = await UserModel.findById(payload.teacherId).select('assistantsAccessEnabled').lean();
        isAccessEnabled = teacher?.assistantsAccessEnabled ?? true;
        // Save to cache
        await cache.set(cacheKey, isAccessEnabled, CacheTTL.ASSISTANTS_ACCESS);
      }

      if (isAccessEnabled === false) {
        throw UnauthorizedException({ message: 'النظام مغلق حالياً من قبل المعلم، يرجى المحاولة لاحقاً' });
      }
    }

    // Attach payload to request for downstream handlers
    (req as any).user = payload;

    // ── Sliding Token ─────────────────────────────────────────────
    // If the token is close to expiry, silently issue a new one.
    // Frontend reads X-New-Token header and replaces the stored token.
    if (payload.exp) {
      const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
      if (secondsLeft < SLIDING_THRESHOLD_SECONDS) {
        const { iat, exp, ...cleanPayload } = payload;
        const freshToken = TokenUtil.generateAccessToken(cleanPayload as IJwtPayload);
        res.setHeader('X-New-Token', freshToken);
      }
    }

    // ── Track Live Presence Asynchronously (Zero Latency) ────────────
    const userId = (payload as any).id || (payload as any)._id || payload.userId;
    if (userId) {
      PresenceService.recordActivity({
        userId: String(userId),
        name: (payload as any).name || 'مستخدم',
        role: payload.role,
        phone: (payload as any).phone,
        teacherId: payload.teacherId ? String(payload.teacherId) : null,
        centerName: (payload as any).centerName,
        currentRoute: req.originalUrl || req.path,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent'] as string | undefined,
      }).catch(() => {});
    }

    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('jwt')) {
      next(UnauthorizedException({ message: 'توثيق غير صالح أو منتهي الصلاحية' }));
    } else {
      next(error);
    }
  }
};
