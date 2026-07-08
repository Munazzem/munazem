/**
 * Creates a new whatsapp-web.js Client bound to `teacherId`.
 *
 * - Uses `LocalAuth({ clientId })` so each teacher has an isolated session
 *   folder (`.wwebjs_auth/session-<teacherId>/`).
 * - QR events save the QR data into the User record so the React dashboard
 *   can render it without terminal access.
 * - `ready` / `disconnected` events update `whatsappStatus` in the DB and
 *   the in-memory pool entry.
 *
 * This function is **non-blocking** — it starts the Puppeteer process in the
 * background and returns immediately.  BullMQ retries handle jobs that
 * arrive before the client is ready.
 */
export declare function initializeClientForTeacher(teacherId: string): Promise<void>;
/**
 * Sends a WhatsApp text message using the teacher's own client instance.
 *
 * Throws if the client isn't in the pool or isn't ready, so BullMQ can
 * trigger a retry with exponential backoff.
 */
export declare function sendWhatsAppMessage(rawParentPhone: string, message: string, teacherId: string): Promise<void>;
export declare function getClientStatus(teacherId: string): 'connected' | 'initializing' | 'disconnected';
/**
 * Tears down the Puppeteer browser for `teacherId` and removes its local
 * session folder so the next scan pairs a completely fresh WhatsApp number.
 *
 * Safe to call even if no client exists in the pool (no-op).
 */
export declare function destroyClientForTeacher(teacherId: string): Promise<void>;
/**
 * Re-initializes clients for all teachers whose `whatsappStatus` was
 * `connected` before the server restarted.
 *
 * Since `LocalAuth` persists the browser session in `.wwebjs_auth/`,
 * these clients will go straight to `authenticated` → `ready` without
 * requiring a new QR scan.
 *
 * Launches are staggered by 2 s to avoid overwhelming the CPU/RAM when
 * many teachers are registered.  This function is fire-and-forget from
 * `bootstrap()` — the Express server starts immediately.
 */
export declare function autoReconnectClients(): Promise<void>;
//# sourceMappingURL=whatsapp.service.d.ts.map