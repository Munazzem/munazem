import { getRedisClient } from '../cache/cache.service.js';
import { logger } from '../../common/utils/logger.util.js';

export interface IActiveUserSession {
    userId: string;
    name: string;
    role: string;
    phone?: string | undefined;
    teacherId?: string | null | undefined;
    teacherName?: string | null | undefined;
    centerName?: string | null | undefined;
    currentRoute?: string | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    lastActiveAt: string;
}

const ZSET_KEY = 'presence:active_zset';
const KEY_PREFIX = 'presence:user:';
const SESSION_TTL_SECONDS = 180; // 3 minutes

// In-memory throttle to avoid hammering Redis on rapid consecutive API calls
const throttleMap = new Map<string, { time: number; route?: string | undefined }>();
// In-memory fallback in case Redis is unavailable
const fallbackPresenceMap = new Map<string, IActiveUserSession>();

export class PresenceService {
    /**
     * Record an active user presence heartbeat
     */
    static async recordActivity(session: Omit<IActiveUserSession, 'lastActiveAt'> & { lastActiveAt?: string }): Promise<void> {
        const now = Date.now();
        const userId = session.userId;
        if (!userId) return;

        // Throttle check: write at most once every 20 seconds unless route changed
        const lastThrottle = throttleMap.get(userId);
        if (lastThrottle && (now - lastThrottle.time < 20_000) && lastThrottle.route === session.currentRoute) {
            return;
        }
        throttleMap.set(userId, { time: now, route: session.currentRoute });

        // Clean throttleMap periodically
        if (throttleMap.size > 2000) {
            for (const [id, val] of throttleMap.entries()) {
                if (now - val.time > 10 * 60_000) throttleMap.delete(id);
            }
        }

        const fullSession: IActiveUserSession = {
            ...session,
            lastActiveAt: new Date(now).toISOString(),
        };

        // Always save to in-memory fallback
        fallbackPresenceMap.set(userId, fullSession);

        try {
            const client = await getRedisClient();
            if (!client) return;

            const userKey = `${KEY_PREFIX}${userId}`;
            await Promise.all([
                client.set(userKey, JSON.stringify(fullSession), 'EX', SESSION_TTL_SECONDS),
                client.zadd(ZSET_KEY, now, userId),
            ]);
        } catch (error) {
            logger.warn('presence_record_failed', { userId, error });
        }
    }

    /**
     * Get all currently active users across the platform
     */
    static async getActiveUsers(): Promise<{ activeUsers: IActiveUserSession[]; totalActive: number }> {
        const now = Date.now();
        const cutoff = now - (SESSION_TTL_SECONDS * 1000);

        try {
            const client = await getRedisClient();
            if (client) {
                // Prune stale sessions older than 3 minutes
                await client.zremrangebyscore(ZSET_KEY, 0, cutoff);

                // Fetch active user IDs sorted by latest activity
                const activeIds: string[] = await client.zrevrangebyscore(ZSET_KEY, '+inf', cutoff);
                if (activeIds.length === 0) {
                    return { activeUsers: [], totalActive: 0 };
                }

                const keys = activeIds.map(id => `${KEY_PREFIX}${id}`);
                const rawSessions: (string | null)[] = await client.mget(...keys);

                const users: IActiveUserSession[] = [];
                const missingIds: string[] = [];

                rawSessions.forEach((raw, idx) => {
                    if (raw) {
                        try {
                            users.push(JSON.parse(raw));
                        } catch {
                            // ignore malformed
                        }
                    } else {
                        missingIds.push(activeIds[idx]!);
                    }
                });

                // Clean up any missing keys from zset
                if (missingIds.length > 0) {
                    await client.zrem(ZSET_KEY, ...missingIds);
                }

                return { activeUsers: users, totalActive: users.length };
            }
        } catch (error) {
            logger.warn('presence_get_failed_using_fallback', { error });
        }

        // Fallback to in-memory map
        const activeUsers: IActiveUserSession[] = [];
        for (const [id, s] of fallbackPresenceMap.entries()) {
            const sessionTime = new Date(s.lastActiveAt).getTime();
            if (now - sessionTime <= SESSION_TTL_SECONDS * 1000) {
                activeUsers.push(s);
            } else {
                fallbackPresenceMap.delete(id);
            }
        }

        activeUsers.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
        return { activeUsers, totalActive: activeUsers.length };
    }
}
