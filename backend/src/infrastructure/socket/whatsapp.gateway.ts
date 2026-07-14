import { Server as SocketServer, Socket } from 'socket.io';
import type { Server as HttpServer }      from 'http';
import { envVars }                         from '../../../config/env.service.js';
import { TokenUtil }                       from '../../common/utils/token.util.js';
import { UserRole }                        from '../../common/enums/enum.service.js';
import { logger }                          from '../../common/utils/logger.util.js';
import type { IJwtPayload }                from '../../types/auth.types.js';

// ─── Event names (shared contract with frontend) ─────────────────────────────
export const WA_EVENTS = {
    QR:           'wa:qr',
    CONNECTED:    'wa:connected',
    DISCONNECTED: 'wa:disconnected',
} as const;

// ─── Payload types ────────────────────────────────────────────────────────────
export interface WaQrPayload          { qr: string }
export interface WaConnectedPayload   { /* intentionally empty */ }
export interface WaDisconnectedPayload { reason?: string }

// ─── Room helper ──────────────────────────────────────────────────────────────
/** Each teacher gets a private room scoped to their ID. */
function teacherRoom(teacherId: string): string {
    return `whatsapp:${teacherId}`;
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _io: SocketServer | null = null;

/**
 * Initialises the Socket.io server and attaches it to the given HTTP server.
 *
 * - CORS origin is read from `envVars.frontendUrl` (comma-separated) so it
 *   works across local / staging / production without touching code.
 * - Authentication happens during the Socket.io handshake: the client sends
 *   `auth: { token }` and the gateway validates it with `TokenUtil`.
 * - Each teacher socket immediately joins room `whatsapp:<teacherId>` so all
 *   subsequent emits are strictly isolated per tenant.
 *
 * Call **once** from `bootstrap()` before `server.listen()`.
 */
export function initWhatsAppGateway(httpServer: HttpServer): void {
    if (_io) {
        logger.warn('whatsapp_gateway_already_initialized');
        return;
    }

    // ── Resolve allowed CORS origins ─────────────────────────────────────────
    const allowedOrigins = envVars.frontendUrl
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

    _io = new SocketServer(httpServer, {
        // ── Namespace: isolate all WA socket traffic ─────────────────────────
        // Only clients connecting to /whatsapp are handled here.
        path: '/socket.io',          // default path — consistent with client
        cors: {
            origin:      allowedOrigins,
            methods:     ['GET', 'POST'],
            credentials: true,
        },
        // ── Transport: prefer WebSocket, fall back to long-polling ────────────
        transports: ['websocket', 'polling'],
        // ── Ping/pong keepalive ───────────────────────────────────────────────
        pingTimeout:  20_000,
        pingInterval: 25_000,
    });

    // ── Namespace: /whatsapp ──────────────────────────────────────────────────
    // All WhatsApp events are scoped to this namespace to prevent
    // accidental cross-feature contamination.
    const waNamespace = _io.of('/whatsapp');

    // ── JWT Authentication Middleware ─────────────────────────────────────────
    // Runs once per connection *before* the socket is admitted.
    // On failure: calls next(err) → Socket.io refuses the connection
    // and the client receives a connection_error — no crash.
    waNamespace.use((socket: Socket, next) => {
        try {
            const token = (socket.handshake.auth as Record<string, string>)?.token;

            if (!token || typeof token !== 'string') {
                logger.warn('whatsapp_gateway_no_token', { socketId: socket.id });
                return next(new Error('UNAUTHORIZED: missing token'));
            }

            let payload: IJwtPayload;
            try {
                payload = TokenUtil.verifyAccessToken(token);
            } catch {
                logger.warn('whatsapp_gateway_invalid_token', { socketId: socket.id });
                return next(new Error('UNAUTHORIZED: invalid or expired token'));
            }

            // Allow teachers and superAdmins
            if (payload.role !== UserRole.teacher && payload.role !== UserRole.superAdmin) {
                logger.warn('whatsapp_gateway_forbidden_role', {
                    socketId: socket.id,
                    role:     payload.role,
                });
                return next(new Error('FORBIDDEN: teachers and superAdmins only'));
            }

            if (!payload.isActive) {
                logger.warn('whatsapp_gateway_inactive_user', { socketId: socket.id });
                return next(new Error('FORBIDDEN: account is inactive'));
            }

            // ── Attach verified identity to socket data ────────────────────────
            // socket.data is Socket.io's safe, per-socket storage.
            socket.data.teacherId = payload.userId;
            socket.data.role      = payload.role;

            next(); // ✅ admit the connection
        } catch (err) {
            // Unexpected error — log it but never crash the process
            logger.error('whatsapp_gateway_middleware_error', {
                socketId: socket.id,
                error:    (err as Error).message,
            });
            next(new Error('INTERNAL: gateway auth error'));
        }
    });

    // ── Connection handler ────────────────────────────────────────────────────
    waNamespace.on('connection', (socket: Socket) => {
        const userId = socket.data.teacherId as string;
        const role   = socket.data.role as string;

        // Join the private room — all server → client emits use this room
        let room = '';
        if (role === UserRole.superAdmin) {
            room = 'super_admins';
        } else {
            room = teacherRoom(userId);
        }
        
        socket.join(room);

        logger.info('whatsapp_gateway_connected', {
            socketId:  socket.id,
            userId,
            room,
        });

        // ── Clean Teardown ────────────────────────────────────────────────────
        // Fires on both intentional disconnects and unexpected drops.
        // socket.rooms is automatically cleared by Socket.io — no manual leave needed.
        socket.on('disconnect', (reason) => {
            logger.info('whatsapp_gateway_disconnected', {
                socketId:  socket.id,
                userId,
                role,
                reason,
            });
            // No manual cleanup required — Socket.io removes the socket from
            // all rooms and nullifies references automatically on disconnect.
        });

        // ── Error handler ─────────────────────────────────────────────────────
        // Prevents uncaught errors on individual sockets from bubbling up
        socket.on('error', (err) => {
            logger.error('whatsapp_gateway_socket_error', {
                socketId:  socket.id,
                userId,
                role,
                error:     err.message,
            });
        });
    });

    logger.info('whatsapp_gateway_initialized', {
        namespace:      '/whatsapp',
        allowedOrigins,
    });
}

// ─── Emit helpers (called from whatsapp.service.ts) ──────────────────────────

/**
 * Emits a WhatsApp event to a specific teacher's private room.
 *
 * Safe to call even before `initWhatsAppGateway` has been called
 * (the guard logs a warning and returns early instead of throwing).
 */
function emitToTeacher(
    teacherId: string,
    event:     string,
    payload:   Record<string, unknown>,
): void {
    if (!_io) {
        logger.warn('whatsapp_gateway_emit_before_init', { teacherId, event });
        return;
    }
    const room = teacherRoom(teacherId);
    _io.of('/whatsapp').to(room).emit(event, payload);
    logger.info('whatsapp_gateway_emit', { teacherId, room, event });
}

/**
 * Emits a WhatsApp event to all superAdmins.
 */
function emitToSuperAdmins(
    event:   string,
    payload: Record<string, unknown>,
): void {
    if (!_io) return;
    _io.of('/whatsapp').to('super_admins').emit(event, payload);
}

/**
 * Returns the gateway's public emit interface.
 * Import and call this from `whatsapp.service.ts`.
 */
export function getWhatsAppGateway() {
    return { emitToTeacher, emitToSuperAdmins };
}
