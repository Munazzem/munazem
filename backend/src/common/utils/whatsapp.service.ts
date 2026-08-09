import WAWebJS from 'whatsapp-web.js';
const { Client, LocalAuth } = WAWebJS;
import fs from 'fs';
import path from 'path';
import { UserModel } from '../../database/models/user.model.js';
import { OptOutModel } from '../../database/models/opt-out.model.js';
import { UserRole }  from '../enums/enum.service.js';
import { logger }    from './logger.util.js';
import { getWhatsAppGateway, WA_EVENTS } from '../../infrastructure/socket/whatsapp.gateway.js';

// ─── Pool types ───────────────────────────────────────────────────────────────
interface PoolEntry {
    client: WAWebJS.Client;
    ready:  boolean;
}

/**
 * In-memory pool of per-teacher WhatsApp clients.
 * Key = teacherId (User._id as string).
 *
 * ⚠️ Each entry launches a separate Puppeteer browser process.
 *    On a 2 GB RAM server ≈ 8-10 concurrent clients is a safe upper bound.
 *    For higher scale, consider a microservice per N teachers.
 */
const clientsPool = new Map<string, PoolEntry>();

/**
 * Tracks teachers currently in the process of initializing.
 * Prevents concurrent initializeClientForTeacher calls for the same teacherId
 * from creating duplicate Puppeteer processes.
 */
const initializingSet = new Set<string>();

import { normalizePhone } from './phone.util.js';

// ─── Session folder path helper ──────────────────────────────────────────────
/**
 * Returns the actual filesystem path that LocalAuth uses to store the session.
 * LocalAuth clientId = `session-<teacherId>`, and it stores under
 * `.wwebjs_auth/session-<clientId>/` → `.wwebjs_auth/session-session-<teacherId>/`
 */
function getSessionFolderPath(teacherId: string): string {
    return path.join(process.cwd(), '.wwebjs_auth', `session-session-${teacherId}`);
}

// ─── DB helpers (fire-and-forget) ─────────────────────────────────────────────
function updateTeacherWA(
    teacherId: string,
    update: { whatsappQr?: string | null; whatsappStatus?: string },
): void {
    UserModel.updateOne({ _id: teacherId }, update).catch((err: Error) => {
        logger.error('whatsapp_db_update_failed', { teacherId, error: err.message });
    });
}

// ─── Initialize a client for a specific teacher ──────────────────────────────
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
export async function initializeClientForTeacher(teacherId: string, force = false): Promise<void> {
    const t0 = Date.now();
    logger.info('[WA] CONNECT_REQUEST_START', { teacherId, force });

    // ── Concurrency lock: prevent duplicate Puppeteer launches ────────────
    if (initializingSet.has(teacherId)) {
        if (!force) {
            logger.info('[WA] INIT_LOCKED — already initializing', { teacherId });
            return;
        }
        // force=true — allow through but log the override
        logger.warn('[WA] INIT_LOCK_OVERRIDE — force reinit while locked', { teacherId });
    }

    const existing = clientsPool.get(teacherId);
    if (existing) {
        if (existing.ready) {
            logger.info('[WA] ALREADY_CONNECTED', { teacherId });
            return; // genuinely connected — nothing to do
        }

        if (!force) {
            // Auto-reconnect path: already initializing in the background
            logger.info('[WA] ALREADY_INITIALIZING', { teacherId });
            return;
        }

        // force=true means the teacher explicitly clicked "توليد QR" again.
        // Destroy the old instance if it exists.
        logger.info('[WA] FORCE_REINIT — destroying stale client', { teacherId });
        clientsPool.delete(teacherId);
        try { await existing.client.destroy(); } catch { /* ignore */ }
    }

    // If force=true, we ALWAYS want a fresh QR code, meaning we must
    // delete the local session folder even if the client wasn't in the pool.
    // (e.g. server restarted, or previous init failed and left a corrupt folder).
    if (force) {
        try {
            const sessionPath = getSessionFolderPath(teacherId);
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                logger.info('[WA] CLEARED_CORRUPT_SESSION', { teacherId, sessionPath });
            }
        } catch (err) {
            logger.error('[WA] CLEAR_SESSION_FAILED', { teacherId, err });
        }
    }

    // Acquire lock
    initializingSet.add(teacherId);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: `session-${teacherId}` }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        },
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            ],
        },
    });

    // Register in pool immediately (ready = false)
    clientsPool.set(teacherId, { client, ready: false });
    logger.info('[WA] CLIENT_CREATED', { teacherId, elapsedMs: Date.now() - t0 });

    // ── QR: save to DB so frontend can render it ──────────────────────────
    client.on('qr', (qr: string) => {
        logger.info('[WA] QR_EVENT_RECEIVED', { teacherId, elapsedMs: Date.now() - t0 });
        // Persist to DB (fire-and-forget — for page refresh recovery)
        updateTeacherWA(teacherId, { whatsappQr: qr, whatsappStatus: 'pending' });
        // Push to teacher's browser in real-time via Socket.io
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.QR, { qr });
    });

    // ── Ready: mark connected ─────────────────────────────────────────────
    client.on('ready', () => {
        const entry = clientsPool.get(teacherId);
        if (entry) entry.ready = true;
        initializingSet.delete(teacherId);  // release lock
        logger.info('[WA] CLIENT_READY', { teacherId, elapsedMs: Date.now() - t0 });
        // Persist to DB (fire-and-forget — clears QR, marks connected)
        updateTeacherWA(teacherId, { whatsappStatus: 'connected', whatsappQr: null });
        // Notify the teacher's browser instantly via Socket.io
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.CONNECTED, {});
    });

    // ── Authenticated: QR was scanned & session confirmed ────────────────────
    // whatsapp-web.js fires 'authenticated' immediately after the QR is scanned,
    // BEFORE 'ready'. In some flows (e.g. existing session re-auth), 'ready'
    // may not re-fire. Emitting here guarantees the frontend transitions the
    // moment the scan is confirmed — 'ready' emit below is a safe double-send.
    client.on('authenticated', () => {
        logger.info('[WA] AUTHENTICATED', { teacherId, elapsedMs: Date.now() - t0 });
        updateTeacherWA(teacherId, { whatsappStatus: 'connected', whatsappQr: null });
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.CONNECTED, {});
    });

    // ── Incoming message: handle opt-out keywords ─────────────────────────
    client.on('message', async (msg: WAWebJS.Message) => {
        const body = (msg.body ?? '').trim().toLowerCase();
        if (body === 'إلغاء' || body === 'الغاء' || body === 'stop') {
            const phone = (msg.from ?? '').split('@')[0]; // e.g. "201012345678"
            if (!phone) return;
            try {
                await OptOutModel.updateOne(
                    { phone: phone, teacherId: teacherId },
                    { $set: { phone: phone, teacherId: teacherId } },
                    { upsert: true },
                );
                await msg.reply('تم إيقاف الرسائل التذكيرية بنجاح ✅');
                logger.info('whatsapp_opt_out', { teacherId, phone });
            } catch (err) {
                logger.error('whatsapp_opt_out_failed', {
                    teacherId, phone, error: (err as Error).message,
                });
            }
        }
    });

    // ── Auth failure: clean up ────────────────────────────────────────────
    client.on('auth_failure', (msg: string) => {
        logger.error('[WA] AUTH_FAILURE', { teacherId, error: msg });
        clientsPool.delete(teacherId);
        initializingSet.delete(teacherId);  // release lock
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.DISCONNECTED, { reason: 'auth_failure' });
    });

    // ── Disconnected: clean up + destroy browser ──────────────────────────
    client.on('disconnected', (reason: string) => {
        logger.warn('[WA] DISCONNECTED', { teacherId, reason });
        clientsPool.delete(teacherId);
        initializingSet.delete(teacherId);  // release lock
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.DISCONNECTED, { reason });
        client.destroy().catch(() => {});
    });

    // Fire-and-forget — Puppeteer launches asynchronously
    logger.info('[WA] INITIALIZE_START', { teacherId, elapsedMs: Date.now() - t0 });
    client.initialize().catch((err: Error) => {
        logger.error('[WA] INIT_FAILED', { teacherId, error: err.message, elapsedMs: Date.now() - t0 });
        clientsPool.delete(teacherId);
        initializingSet.delete(teacherId);  // release lock
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
        // Notify the frontend so the UI snaps back to 'disconnected' instead of
        // staying frozen on the "جاري تجهيز كود الربط..." spinner indefinitely.
        getWhatsAppGateway().emitToTeacher(teacherId, WA_EVENTS.DISCONNECTED, { reason: 'init_failed' });
    });

    logger.info('[WA] RESPONSE_SENT', { teacherId, elapsedMs: Date.now() - t0 });
}

// ─── Send message via the teacher's client ────────────────────────────────────
/**
 * Sends a WhatsApp text message using the teacher's own client instance.
 *
 * Throws if the client isn't in the pool or isn't ready, so BullMQ can
 * trigger a retry with exponential backoff.
 */
export async function sendWhatsAppMessage(
    rawParentPhone: string,
    message:        string,
    teacherId:      string,
): Promise<void> {
    const entry = clientsPool.get(teacherId);
    if (!entry || !entry.ready) {
        throw new Error(
            `WhatsApp client for teacher ${teacherId} is not ready — job will be retried by BullMQ`,
        );
    }

    const phone  = normalizePhone(rawParentPhone);
    const chatId = `${phone}@c.us`;

    try {
        await entry.client.sendMessage(chatId, message);
        logger.info('whatsapp_sent', { phone, teacherId });
    } catch (err: any) {
        const errorMsg = err.message || '';
        // If the error implies block/not allowed (e.g. "Evaluation failed", "Failed to send message")
        if (errorMsg.includes('Failed to send message') || errorMsg.includes('Protocol error')) {
            logger.warn('whatsapp_send_blocked', { phone, teacherId, error: errorMsg });
            throw new Error(`BLOCKED: ${errorMsg}`);
        }
        throw err;
    }
}

// ─── Check Phone Registration ────────────────────────────────────────────────
/**
 * Checks if a phone number is registered on WhatsApp using the teacher's client.
 */
export async function checkPhoneRegistration(teacherId: string, rawParentPhone: string): Promise<boolean> {
    const entry = clientsPool.get(teacherId);
    if (!entry || !entry.ready) {
        throw new Error(
            `WhatsApp client for teacher ${teacherId} is not ready — cannot check registration.`,
        );
    }
    const phone = normalizePhone(rawParentPhone);
    const chatId = `${phone}@c.us`;
    
    try {
        const isRegistered = await entry.client.isRegisteredUser(chatId);
        return isRegistered;
    } catch (err) {
        logger.error('whatsapp_check_registration_failed', { teacherId, phone, error: (err as Error).message });
        return true; // Fallback to true so we don't accidentally block valid numbers on temporary errors
    }
}

// ─── Pool status helper ───────────────────────────────────────────────────────
export function getClientStatus(teacherId: string): 'connected' | 'initializing' | 'disconnected' {
    const entry = clientsPool.get(teacherId);
    if (!entry) return 'disconnected';
    return entry.ready ? 'connected' : 'initializing';
}

// ─── Graceful disconnect (called from the REST disconnect endpoint) ────────────────
/**
 * Tears down the Puppeteer browser for `teacherId` and removes its local
 * session folder so the next scan pairs a completely fresh WhatsApp number.
 *
 * Safe to call even if no client exists in the pool (no-op).
 */
export async function destroyClientForTeacher(teacherId: string): Promise<void> {
    const entry = clientsPool.get(teacherId);
    clientsPool.delete(teacherId);              // remove from pool first
    initializingSet.delete(teacherId);

    if (entry) {
        try {
            await entry.client.logout();         // revoke session on WA servers
        } catch { /* ignore */ }
        try {
            await entry.client.destroy();        // kill the Puppeteer browser
        } catch { /* ignore */ }
    }

    // LocalAuth stores session in .wwebjs_auth/session-<clientId>/
    // Delete it so the next connect generates a fresh QR for a new number.
    try {
        const { rm } = await import('fs/promises');
        const sessionDir = getSessionFolderPath(teacherId);
        await rm(sessionDir, { recursive: true, force: true });
        logger.info('whatsapp_session_deleted', { teacherId, sessionDir });
    } catch (err) {
        // Non-fatal: session folder may not exist yet
        logger.warn('whatsapp_session_delete_failed', { teacherId, error: (err as Error).message });
    }

    logger.info('whatsapp_client_destroyed', { teacherId });
}

// ─── Auto-reconnect on server boot ────────────────────────────────────────────
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
export async function autoReconnectClients(): Promise<void> {
    try {
        const teachers = await UserModel.find(
            { whatsappStatus: 'connected', role: UserRole.teacher },
            { _id: 1 },
        ).lean();

        if (teachers.length === 0) {
            logger.info('whatsapp_no_clients_to_reconnect');
            return;
        }

        logger.info('whatsapp_auto_reconnect_start', { count: teachers.length });

        const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

        for (const teacher of teachers) {
            const teacherId = teacher._id.toString();

            // Check if session folder actually exists — if it doesn't,
            // there's nothing to reconnect. Mark DB as disconnected
            // so the teacher knows to scan a fresh QR.
            const sessionPath = getSessionFolderPath(teacherId);
            if (!fs.existsSync(sessionPath)) {
                logger.warn('[WA] AUTO_RECONNECT_NO_SESSION — marking disconnected', {
                    teacherId,
                    sessionPath,
                });
                updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
                continue;
            }

            // Each call is non-blocking — client.initialize() runs in bg
            await initializeClientForTeacher(teacherId);
            // Stagger launches so Puppeteer processes don't all start at once
            await sleep(2_000);
        }

        logger.info('whatsapp_auto_reconnect_queued', { count: teachers.length });
    } catch (err) {
        logger.error('whatsapp_auto_reconnect_failed', { error: (err as Error).message });
    }
}
