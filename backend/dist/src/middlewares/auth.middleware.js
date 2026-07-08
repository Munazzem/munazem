import { UnauthorizedException } from '../common/utils/response/error.responce.js';
import { TokenUtil } from '../common/utils/token.util.js';
import { cache, CacheKeys, CacheTTL } from '../infrastructure/cache/cache.service.js';
import { UserModel } from '../database/models/user.model.js';
// Threshold: issue fresh token if less than 5 minutes remain
const SLIDING_THRESHOLD_SECONDS = 5 * 60;
export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw UnauthorizedException({ message: 'الرجاء تسجيل الدخول للوصول إلى هذا المسار' });
        }
        const token = authHeader.split(' ')[1];
        // Verify token signature and expiration — no DB call needed
        const payload = TokenUtil.verifyAccessToken(token);
        // isActive is embedded in the JWT payload — zero DB cost
        if (!payload.isActive) {
            throw UnauthorizedException({ message: 'تم إيقاف هذا الحساب، يرجى مراجعة الإدارة' });
        }
        // ── Assistant Kill Switch Check ──────────────────────────────────────
        if (payload.role === 'assistant' && payload.teacherId) {
            const cacheKey = CacheKeys.assistantsAccess(payload.teacherId);
            let isAccessEnabled = await cache.get(cacheKey);
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
        req.user = payload;
        // ── Sliding Token ─────────────────────────────────────────────
        // If the token is close to expiry, silently issue a new one.
        // Frontend reads X-New-Token header and replaces the stored token.
        if (payload.exp) {
            const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
            if (secondsLeft < SLIDING_THRESHOLD_SECONDS) {
                const { iat, exp, ...cleanPayload } = payload;
                const freshToken = TokenUtil.generateAccessToken(cleanPayload);
                res.setHeader('X-New-Token', freshToken);
            }
        }
        next();
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('jwt')) {
            next(UnauthorizedException({ message: 'توثيق غير صالح أو منتهي الصلاحية' }));
        }
        else {
            next(error);
        }
    }
};
//# sourceMappingURL=auth.middleware.js.map