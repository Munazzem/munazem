/**
 * Track a business event — dual-writes to MongoDB (for admin dashboard)
 * and stdout (for DevOps/Render logs).
 *
 * Fire-and-forget by design: if the DB write fails, the request is NOT affected.
 * These events are informational, not critical.
 */
export declare function trackEvent(event: string, data: {
    tenantId: string;
    userId: string;
    targetId?: string;
    meta?: Record<string, unknown>;
}): void;
//# sourceMappingURL=activity.service.d.ts.map