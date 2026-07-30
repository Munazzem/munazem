import { SubscriptionModel } from '../../database/models/subscription.model.js';
import { SubscriptionPlan, SubscriptionStatus } from '../enums/enum.service.js';
import { cache, CacheKeys, CacheTTL } from '../../infrastructure/cache/cache.service.js';
import { logger } from './logger.util.js';

// ─── Cache key for premium check ─────────────────────────────────────────────
const premiumCacheKey = (teacherId: string) => `wa:premium:${teacherId}`;

/**
 * Check if a teacher has an active Premium subscription.
 *
 * This is the **Single Source of Truth** for the WhatsApp Premium gate.
 * Result is cached in Redis for 10 minutes to avoid a DB query per enqueue.
 *
 * Used exclusively by `enqueueWhatsApp()` — no other code path should
 * bypass this check.
 */
export async function isTeacherPremium(teacherId: string): Promise<boolean> {
    const cacheKey = premiumCacheKey(teacherId);

    // 1. Try cache first
    const cached = await cache.get<boolean>(cacheKey);
    if (cached !== null) return cached;

    // 2. Cache miss — query MongoDB
    try {
        const now = new Date();
        const activeSub = await SubscriptionModel.findOne({
            teacherId,
            status:   SubscriptionStatus.ACTIVE,
            planTier: SubscriptionPlan.PREMIUM,
            endDate:  { $gt: now },
        }).lean();

        const isPremium = !!activeSub;

        // Cache for 10 minutes — balances freshness with performance
        await cache.set(cacheKey, isPremium, 600);

        return isPremium;
    } catch (err) {
        logger.error('premium_check_failed', {
            teacherId,
            error: (err as Error).message,
        });
        // On error, default to false — safe side (don't send if unsure)
        return false;
    }
}

/**
 * Invalidate the premium cache for a teacher.
 * Call this when a subscription is created, updated, or expires.
 */
export async function invalidatePremiumCache(teacherId: string): Promise<void> {
    await cache.del(premiumCacheKey(teacherId));
}
