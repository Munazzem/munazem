import { Worker } from 'bullmq';
import type { EmailJobData } from './queue.types.js';
/**
 * Creates and starts the BullMQ Worker for email jobs.
 * concurrency: 2 — emails are independent and fast, no ban risk.
 */
export declare function startEmailWorker(): Worker<EmailJobData>;
//# sourceMappingURL=email.processor.d.ts.map