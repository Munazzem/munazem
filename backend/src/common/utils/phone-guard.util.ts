import { cache } from '../../infrastructure/cache/cache.service.js';
import { PhoneStatusModel } from '../../database/models/phone-status.model.js';
import { logger } from './logger.util.js';

type PhoneStatus = 'valid' | 'invalid' | 'blocked';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export class PhoneGuard {
    private static buildCacheKey(teacherId: string, phone: string) {
        return `phone_status:${teacherId}:${phone}`;
    }

    /**
     * Get the known status of a phone number for a specific teacher.
     * Returns null if unknown or if the cache/DB is expired.
     */
    static async getStatus(teacherId: string, phone: string): Promise<PhoneStatus | null> {
        const cacheKey = this.buildCacheKey(teacherId, phone);
        
        // 1. Check Redis Cache
        const cached = await cache.get<PhoneStatus>(cacheKey);
        if (cached) return cached;

        // 2. Check Database
        try {
            const record = await PhoneStatusModel.findOne({ teacherId, phone }).lean();
            if (record) {
                // If it's older than 24 hours, consider it unknown to force a re-check
                const ageMs = Date.now() - new Date(record.lastChecked).getTime();
                if (ageMs < CACHE_TTL_SECONDS * 1000) {
                    await cache.set(cacheKey, record.status, CACHE_TTL_SECONDS);
                    return record.status;
                }
            }
        } catch (err) {
            logger.error('phone_guard_db_error', { teacherId, phone, error: (err as Error).message });
        }

        return null;
    }

    /**
     * Update the known status of a phone number for a specific teacher.
     */
    static async setStatus(teacherId: string, phone: string, status: PhoneStatus): Promise<void> {
        const cacheKey = this.buildCacheKey(teacherId, phone);
        
        // Update Redis Cache
        await cache.set(cacheKey, status, CACHE_TTL_SECONDS);

        // Update Database (Upsert)
        try {
            await PhoneStatusModel.updateOne(
                { teacherId, phone },
                { $set: { status, lastChecked: new Date() } },
                { upsert: true }
            );
        } catch (err) {
            logger.error('phone_guard_db_update_error', { teacherId, phone, error: (err as Error).message });
        }
    }
}
