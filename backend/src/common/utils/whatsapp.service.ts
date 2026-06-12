import WAWebJS from 'whatsapp-web.js';
const { Client, LocalAuth } = WAWebJS;
import { UserModel } from '../../database/models/user.model.js';
import { OptOutModel } from '../../database/models/opt-out.model.js';
import { UserRole }  from '../enums/enum.service.js';
import { logger }    from './logger.util.js';

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

// ─── Phone normalizer ─────────────────────────────────────────────────────────
// Matches our existing format in generateWhatsAppLinks (attendance.service.ts)
// Egyptian numbers: 010… → 2010…  |  raw 10-digit → 20 + raw
function normalizePhone(raw: string): string {
    let clean = raw.replace(/\D/g, '');
    if (clean.startsWith('01'))  clean = '2'  + clean;
    else if (!clean.startsWith('20') && clean.length === 10) clean = '20' + clean;
    return clean;
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
export async function initializeClientForTeacher(teacherId: string): Promise<void> {
    // Guard: already in pool
    const existing = clientsPool.get(teacherId);
    if (existing) {
        if (existing.ready) {
            logger.info('whatsapp_already_connected', { teacherId });
        } else {
            logger.info('whatsapp_already_initializing', { teacherId });
        }
        return;
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: `session-${teacherId}` }),
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
            ],
        },
    });

    // Register in pool immediately (ready = false)
    clientsPool.set(teacherId, { client, ready: false });

    // ── QR: save to DB so frontend can render it ──────────────────────────
    client.on('qr', (qr: string) => {
        logger.info('whatsapp_qr_received', { teacherId });
        updateTeacherWA(teacherId, { whatsappQr: qr, whatsappStatus: 'pending' });
    });

    // ── Ready: mark connected ─────────────────────────────────────────────
    client.on('ready', () => {
        const entry = clientsPool.get(teacherId);
        if (entry) entry.ready = true;
        logger.info('whatsapp_client_ready', { teacherId });
        updateTeacherWA(teacherId, { whatsappStatus: 'connected', whatsappQr: null });
    });

    // ── Authenticated: informational only ─────────────────────────────────
    client.on('authenticated', () => {
        logger.info('whatsapp_authenticated', { teacherId });
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
        logger.error('whatsapp_auth_failure', { teacherId, error: msg });
        clientsPool.delete(teacherId);
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
    });

    // ── Disconnected: clean up + destroy browser ──────────────────────────
    client.on('disconnected', (reason: string) => {
        logger.warn('whatsapp_disconnected', { teacherId, reason });
        clientsPool.delete(teacherId);
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
        client.destroy().catch(() => {});
    });

    // Fire-and-forget — Puppeteer launches asynchronously
    client.initialize().catch((err: Error) => {
        logger.error('whatsapp_init_failed', { teacherId, error: err.message });
        clientsPool.delete(teacherId);
        updateTeacherWA(teacherId, { whatsappStatus: 'disconnected', whatsappQr: null });
    });
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

    await entry.client.sendMessage(chatId, message);

    logger.info('whatsapp_sent', { phone, teacherId });
}

// ─── Pool status helper ───────────────────────────────────────────────────────
export function getClientStatus(teacherId: string): 'connected' | 'initializing' | 'disconnected' {
    const entry = clientsPool.get(teacherId);
    if (!entry) return 'disconnected';
    return entry.ready ? 'connected' : 'initializing';
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
            // Each call is non-blocking — client.initialize() runs in bg
            await initializeClientForTeacher(teacher._id.toString());
            // Stagger launches so Puppeteer processes don't all start at once
            await sleep(2_000);
        }

        logger.info('whatsapp_auto_reconnect_queued', { count: teachers.length });
    } catch (err) {
        logger.error('whatsapp_auto_reconnect_failed', { error: (err as Error).message });
    }
}
