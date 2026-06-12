import { envVars } from '../../../config/env.service.js';
import { logger }  from '../../common/utils/logger.util.js';

/**
 * Lightweight Redis caching layer.
 * Uses the same Redis connection as BullMQ (envVars.redisUrl).
 *
 * Design decisions:
 * - Lazy connection: connects on first use, not at import time
 * - Graceful degradation: if Redis is down, returns null (cache miss) — never throws
 * - JSON serialization: all values are stored as JSON strings
 * - Key namespacing: all keys prefixed with 'cache:' to avoid collision with BullMQ
 */

// ── Dynamic import ioredis (BullMQ already depends on it) ────────────────────
let redisClient: any = null;
let connectionFailed = false;

async function getClient(): Promise<any> {
    if (connectionFailed) return null;
    if (redisClient) return redisClient;

    try {
        // ioredis is already installed as a BullMQ dependency
        const IORedis = await import('ioredis');
        const Redis = IORedis.default || IORedis;
        redisClient = new (Redis as any)(envVars.redisUrl, {
            maxRetriesPerRequest: 1,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    connectionFailed = true;
                    logger.warn('cache_redis_failed', { message: 'Cache Redis connection failed after 3 retries — caching disabled' });
                    return null; // stop retrying
                }
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });
        await redisClient.connect();
        logger.info('cache_redis_connected');
        return redisClient;
    } catch {
        connectionFailed = true;
        logger.warn('cache_redis_unavailable', { message: 'Redis not available — caching disabled, app continues without cache' });
        return null;
    }
}

const KEY_PREFIX = 'cache:';

export const cache = {
    /**
     * Get a cached value. Returns null on miss or error.
     */
    async get<T = any>(key: string): Promise<T | null> {
        try {
            const client = await getClient();
            if (!client) return null;

            const raw = await client.get(KEY_PREFIX + key);
            if (!raw) return null;

            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },

    /**
     * Set a cached value with TTL in seconds.
     */
    async set(key: string, value: any, ttlSeconds: number): Promise<void> {
        try {
            const client = await getClient();
            if (!client) return;

            await client.set(KEY_PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
        } catch {
            // Silently fail — caching is a performance enhancement, not critical
        }
    },

    /**
     * Delete a specific key.
     */
    async del(key: string): Promise<void> {
        try {
            const client = await getClient();
            if (!client) return;

            await client.del(KEY_PREFIX + key);
        } catch {
            // Silently fail
        }
    },

    /**
     * Invalidate all cache keys matching a pattern.
     * Example: invalidate('t:abc123:*') deletes all keys for teacher abc123.
     *
     * Uses SCAN (non-blocking) instead of KEYS (blocking).
     */
    async invalidate(pattern: string): Promise<void> {
        try {
            const client = await getClient();
            if (!client) return;

            const fullPattern = KEY_PREFIX + pattern;
            let cursor = '0';

            do {
                const [nextCursor, keys] = await client.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
                cursor = nextCursor;

                if (keys.length > 0) {
                    await client.del(...keys);
                }
            } while (cursor !== '0');
        } catch {
            // Silently fail
        }
    },
};

// ── Cache key builders ───────────────────────────────────────────────────────
// Centralized key definitions to avoid typos and ensure consistent invalidation.

export const CacheKeys = {
    dashboard:     (teacherId: string) => `t:${teacherId}:dashboard`,
    priceSettings: (teacherId: string) => `t:${teacherId}:prices`,
    groups:        (teacherId: string) => `t:${teacherId}:groups`,
    /** Pattern to invalidate ALL cache for a teacher */
    teacherAll:    (teacherId: string) => `t:${teacherId}:*`,
};

// ── Cache TTLs (seconds) ─────────────────────────────────────────────────────
export const CacheTTL = {
    DASHBOARD:      5 * 60,     // 5 minutes
    PRICE_SETTINGS: 60 * 60,    // 1 hour
    GROUPS:         10 * 60,    // 10 minutes
};
