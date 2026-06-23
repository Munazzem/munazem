import { ActivityLogModel } from '../../database/models/activity-log.model.js';
import { logger } from './logger.util.js';
/**
 * Track a business event — dual-writes to MongoDB (for admin dashboard)
 * and stdout (for DevOps/Render logs).
 *
 * Fire-and-forget by design: if the DB write fails, the request is NOT affected.
 * These events are informational, not critical.
 */
export function trackEvent(event, data) {
    // 1. Structured log to stdout (for Render/grep)
    logger.info(event, { ...data });
    // 2. Persist to MongoDB (for admin dashboard) — fire-and-forget
    ActivityLogModel.create({
        event,
        tenantId: data.tenantId,
        userId: data.userId,
        ...(data.targetId ? { targetId: data.targetId } : {}),
        ...(data.meta ? { meta: data.meta } : {}),
    }).catch(() => {
        // Silently swallow — activity logging should never break the main flow
    });
}
//# sourceMappingURL=activity.service.js.map