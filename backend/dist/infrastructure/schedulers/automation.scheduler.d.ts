/**
 * Registers repeatable (cron) jobs in BullMQ and starts a Worker to process
 * them.  Call this once from `bootstrap()` in app.controller.ts.
 *
 * BullMQ stores repeatable job definitions in Redis, so they survive server
 * restarts.  `upsertJobScheduler` ensures no duplicates.
 */
export declare function startAutomationScheduler(): Promise<void>;
//# sourceMappingURL=automation.scheduler.d.ts.map