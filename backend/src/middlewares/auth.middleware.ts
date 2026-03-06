import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedException } from '../common/utils/response/error.responce.js';
import { TokenUtil } from '../common/utils/token.util.js';
import type { IJwtPayload } from '../types/auth.types.js';

// Threshold: issue fresh token if less than 5 minutes remain
const SLIDING_THRESHOLD_SECONDS = 5 * 60;

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw UnauthorizedException({ message: 'الرجاء تسجيل الدخول للوصول إلى هذا المسار' });
    }

    const token = authHeader.split(' ')[1] as string;

    // Verify token signature and expiration — no DB call needed
    const payload = TokenUtil.verifyAccessToken(token) as IJwtPayload;

    // isActive is embedded in the JWT payload — zero DB cost
    if (!payload.isActive) {
      throw UnauthorizedException({ message: 'تم إيقاف هذا الحساب، يرجى مراجعة الإدارة' });
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

    next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('jwt')) {
      next(UnauthorizedException({ message: 'توثيق غير صالح أو منتهي الصلاحية' }));
    } else {
      next(error);
    }
  }
};
