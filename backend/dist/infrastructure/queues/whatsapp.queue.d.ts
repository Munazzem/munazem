import { Queue } from 'bullmq';
import type { WhatsAppJobData, EmailJobData } from './queue.types.js';
export declare const whatsAppQueue: Queue<WhatsAppJobData, any, string, WhatsAppJobData, any, string>;
export declare const emailQueue: Queue<import("./queue.types.js").WeeklyTeacherReportPayload, any, string, import("./queue.types.js").WeeklyTeacherReportPayload, any, string>;
/**
 * Add a single WhatsApp notification job to the queue.
 * Fire-and-forget — logs a warning on failure but never throws.
 * Callers (completeSession, batchRecordResults) must not be blocked by this.
 */
export declare function enqueueWhatsApp(data: WhatsAppJobData): void;
export declare function enqueueEmail(data: EmailJobData, forceTest?: boolean): void;
//# sourceMappingURL=whatsapp.queue.d.ts.map