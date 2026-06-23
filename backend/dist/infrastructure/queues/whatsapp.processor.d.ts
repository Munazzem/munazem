import { Worker } from 'bullmq';
import type { WhatsAppJobData } from './queue.types.js';
/**
 * Creates and starts the BullMQ Worker.
 * Call this once from `bootstrap()` in app.controller.ts.
 *
 * concurrency: 50 — allows processing multiple messages simultaneously.
 * The Redis Lock inside processWhatsAppJob ensures that messages from the
 * SAME teacher are spaced by 12 seconds, while different teachers run in parallel.
 */
export declare function startWhatsAppWorker(): Worker<WhatsAppJobData>;
//# sourceMappingURL=whatsapp.processor.d.ts.map