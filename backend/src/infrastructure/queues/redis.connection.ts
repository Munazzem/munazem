import { Redis } from 'ioredis';
import { envVars } from '../../../config/env.service.js';
import { logger } from '../../common/utils/logger.util.js';

export const redisConnectionOptions = {
    url: envVars.redisUrl,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => {
        if (times > 3) return null; // Stop reconnecting after 3 failed attempts
        return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
};

let _redisAvailable: boolean | null = null;

/**
 * Checks whether Redis is running and has a version compatible with BullMQ (>= 5.0.0).
 * Results are cached so subsequent checks don't incur connection overhead.
 */
export async function isRedisAvailable(): Promise<boolean> {
    if (_redisAvailable !== null) return _redisAvailable;

    try {
        const client = new Redis(envVars.redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            lazyConnect: true,
        });

        // Silence unhandled error events during connection probing
        client.on('error', () => {});

        await client.connect();
        const info = await client.info('server');
        await client.quit().catch(() => {});

        const match = info.match(/redis_version:([0-9]+)\.([0-9]+)/);
        if (match) {
            const major = parseInt(match[1] || '0', 10);
            if (major < 5) {
                logger.warn('redis_version_incompatible', {
                    message: `Redis version is ${match[1]}.${match[2]}, but BullMQ requires Redis >= 5.0.0. Background workers paused.`,
                });
                _redisAvailable = false;
                return false;
            }
        }

        _redisAvailable = true;
        return true;
    } catch {
        _redisAvailable = false;
        logger.warn('redis_offline', {
            message: `Redis is not running at ${envVars.redisUrl}. Background queue workers (WhatsApp, Email, Automation) are paused. REST API is running normally.`,
        });
        return false;
    }
}
