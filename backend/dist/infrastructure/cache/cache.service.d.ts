export declare const cache: {
    /**
     * Get a cached value. Returns null on miss or error.
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * Set a cached value with TTL in seconds.
     */
    set(key: string, value: any, ttlSeconds: number): Promise<void>;
    /**
     * Delete a specific key.
     */
    del(key: string): Promise<void>;
    /**
     * Invalidate all cache keys matching a pattern.
     * Example: invalidate('t:abc123:*') deletes all keys for teacher abc123.
     *
     * Uses SCAN (non-blocking) instead of KEYS (blocking).
     */
    invalidate(pattern: string): Promise<void>;
};
export declare const CacheKeys: {
    dashboard: (teacherId: string) => string;
    priceSettings: (teacherId: string) => string;
    groups: (teacherId: string) => string;
    /** Pattern to invalidate ALL cache for a teacher */
    teacherAll: (teacherId: string) => string;
};
export declare const CacheTTL: {
    DASHBOARD: number;
    PRICE_SETTINGS: number;
    GROUPS: number;
};
//# sourceMappingURL=cache.service.d.ts.map