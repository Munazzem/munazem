/**
 * tests/unit/whatsapp.service.test.ts
 *
 * Unit tests for src/common/utils/whatsapp.service.ts
 *
 * Strategy:
 *  - Mock whatsapp-web.js entirely (no real Puppeteer)
 *  - Mock fs (session folder existence checks)
 *  - Mock UserModel (DB writes)
 *  - Mock the Socket.io gateway (emitToTeacher)
 *  - Read internal state through getClientStatus() (the public status accessor)
 *
 * Because the service keeps in-memory Map/Set as module-level singletons, we
 * call vi.resetModules() inside beforeEach so every test starts with clean singletons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared Fake Client Class ──────────────────────────────────────────────────
class FakeClient {
    private _listeners: Record<string, ((...args: any[]) => void)[]> = {};

    on(event: string, cb: (...args: any[]) => void) {
        (this._listeners[event] ??= []).push(cb);
        return this;
    }

    emit(event: string, ...args: any[]) {
        for (const cb of this._listeners[event] ?? []) cb(...args);
    }

    initialize       = vi.fn().mockResolvedValue(undefined);
    destroy          = vi.fn().mockResolvedValue(undefined);
    logout           = vi.fn().mockResolvedValue(undefined);
    sendMessage      = vi.fn().mockResolvedValue(undefined);
    isRegisteredUser = vi.fn().mockResolvedValue(true);
}

let fakeClient: FakeClient;
const ClientMock = vi.fn().mockImplementation(function (this: any) {
    fakeClient = new FakeClient();
    return fakeClient;
});
const LocalAuthMock = vi.fn().mockImplementation(function (this: any) {
    return this;
});

// ─── Module Mocks ─────────────────────────────────────────────────────────────
vi.mock('whatsapp-web.js', () => ({
    default: {
        Client:    ClientMock,
        LocalAuth: LocalAuthMock,
    },
}));

const fsMock = {
    existsSync: vi.fn().mockReturnValue(false),
    rmSync:     vi.fn(),
};
vi.mock('fs', () => ({ default: fsMock }));

const rmMock = vi.fn().mockResolvedValue(undefined);
vi.mock('fs/promises', () => ({ rm: rmMock }));

let mockTeachersResult: any[] = [];
const userModelMock = {
    updateOne: vi.fn().mockResolvedValue({}),
    find:      vi.fn().mockImplementation(() => ({
        lean: vi.fn().mockResolvedValue(mockTeachersResult),
    })),
};
vi.mock('../../src/database/models/user.model.js', () => ({
    UserModel: userModelMock,
}));

vi.mock('../../src/database/models/opt-out.model.js', () => ({
    OptOutModel: { updateOne: vi.fn().mockResolvedValue({}) },
}));

const emitToTeacherMock = vi.fn();
vi.mock('../../src/infrastructure/socket/whatsapp.gateway.js', () => ({
    WA_EVENTS: {
        QR:           'wa:qr',
        CONNECTED:    'wa:connected',
        DISCONNECTED: 'wa:disconnected',
    },
    getWhatsAppGateway: () => ({ emitToTeacher: emitToTeacherMock }),
}));

vi.mock('../../src/common/utils/logger.util.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/common/utils/phone.util.js', () => ({
    normalizePhone: (p: string) => p.replace(/\D/g, '').replace(/^0/, '20'),
}));

vi.mock('../../src/common/enums/enum.service.js', () => ({
    UserRole: { teacher: 'teacher' },
}));

// Helper to get fresh module instance with clean internal Map/Set
async function getCleanService() {
    vi.resetModules();
    return await import('../../src/common/utils/whatsapp.service.js');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getSessionFolderPath (via destroy/force-reinit)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses session-session-{teacherId} path — not session-{teacherId}', async () => {
        const { destroyClientForTeacher } = await getCleanService();
        await destroyClientForTeacher('abc123');

        expect(rmMock).toHaveBeenCalledWith(
            expect.stringContaining('session-session-abc123'),
            expect.objectContaining({ recursive: true }),
        );
        expect(rmMock).not.toHaveBeenCalledWith(
            expect.stringContaining('.wwebjs_auth\\session-abc123'),
            expect.anything(),
        );
    });
});

describe('initializeClientForTeacher — initialization lock (initializingSet)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('non-force second call while initializing is a no-op', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();

        await initializeClientForTeacher('teacher1');
        expect(getClientStatus('teacher1')).toBe('initializing');

        const initialCallCount = ClientMock.mock.calls.length;

        await initializeClientForTeacher('teacher1');
        expect(ClientMock).toHaveBeenCalledTimes(initialCallCount);
    });

    it('force=true breaks the lock and creates a fresh client', async () => {
        const { initializeClientForTeacher } = await getCleanService();

        await initializeClientForTeacher('teacher2');
        const firstClient = fakeClient;

        await initializeClientForTeacher('teacher2', true);
        const secondClient = fakeClient;

        expect(secondClient).not.toBe(firstClient);
        expect(firstClient.destroy).toHaveBeenCalled();
    });

    it('lock is released after init_failed', async () => {
        const { initializeClientForTeacher } = await getCleanService();

        await initializeClientForTeacher('teacher3');
        fakeClient.initialize.mockRejectedValueOnce(new Error('Puppeteer crashed'));

        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        await expect(initializeClientForTeacher('teacher3')).resolves.toBeUndefined();
    });

    it('lock is released after disconnected event', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();

        await initializeClientForTeacher('teacher4');
        expect(getClientStatus('teacher4')).toBe('initializing');

        fakeClient.emit('disconnected', 'LOGOUT');
        expect(getClientStatus('teacher4')).toBe('disconnected');

        await initializeClientForTeacher('teacher4');
        expect(getClientStatus('teacher4')).toBe('initializing');
    });

    it('lock is released after auth_failure event', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();

        await initializeClientForTeacher('teacher5');
        fakeClient.emit('auth_failure', 'Unauthorized');

        expect(getClientStatus('teacher5')).toBe('disconnected');
    });
});

describe('initializeClientForTeacher — happy path lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates client, sets pool to initializing, calls initialize()', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();

        await initializeClientForTeacher('teacherA');

        expect(ClientMock).toHaveBeenCalled();
        expect(fakeClient.initialize).toHaveBeenCalled();
        expect(getClientStatus('teacherA')).toBe('initializing');
    });

    it('qr event saves to DB and emits via Socket.io', async () => {
        const { initializeClientForTeacher } = await getCleanService();
        await initializeClientForTeacher('teacherB');

        fakeClient.emit('qr', 'fake-qr-data-string');

        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherB' },
            expect.objectContaining({ whatsappQr: 'fake-qr-data-string', whatsappStatus: 'pending' }),
        );
        expect(emitToTeacherMock).toHaveBeenCalledWith('teacherB', 'wa:qr', { qr: 'fake-qr-data-string' });
    });

    it('ready event marks pool as connected, updates DB, emits CONNECTED', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();
        await initializeClientForTeacher('teacherC');

        fakeClient.emit('ready');

        expect(getClientStatus('teacherC')).toBe('connected');
        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherC' },
            expect.objectContaining({ whatsappStatus: 'connected', whatsappQr: null }),
        );
        expect(emitToTeacherMock).toHaveBeenCalledWith('teacherC', 'wa:connected', {});
    });

    it('authenticated event updates DB and emits CONNECTED', async () => {
        const { initializeClientForTeacher } = await getCleanService();
        await initializeClientForTeacher('teacherD');

        fakeClient.emit('authenticated');

        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherD' },
            expect.objectContaining({ whatsappStatus: 'connected', whatsappQr: null }),
        );
        expect(emitToTeacherMock).toHaveBeenCalledWith('teacherD', 'wa:connected', {});
    });

    it('disconnected event removes from pool, updates DB, emits DISCONNECTED', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();
        await initializeClientForTeacher('teacherE');

        fakeClient.emit('disconnected', 'NAVIGATION');

        expect(getClientStatus('teacherE')).toBe('disconnected');
        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherE' },
            expect.objectContaining({ whatsappStatus: 'disconnected', whatsappQr: null }),
        );
        expect(emitToTeacherMock).toHaveBeenCalledWith(
            'teacherE', 'wa:disconnected', { reason: 'NAVIGATION' },
        );
    });

    it('already connected guard returns early without creating new client', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();

        await initializeClientForTeacher('teacherF');
        fakeClient.emit('ready');
        expect(getClientStatus('teacherF')).toBe('connected');

        const callCount = ClientMock.mock.calls.length;
        await initializeClientForTeacher('teacherF');

        expect(ClientMock).toHaveBeenCalledTimes(callCount);
    });
});

describe('initializeClientForTeacher — force=true with existing stale entry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('destroys old client before creating new one', async () => {
        const { initializeClientForTeacher } = await getCleanService();

        await initializeClientForTeacher('teacherG');
        const staleClient = fakeClient;

        await initializeClientForTeacher('teacherG', true);

        expect(staleClient.destroy).toHaveBeenCalled();
        expect(fakeClient).not.toBe(staleClient);
    });

    it('deletes session folder (correct path) before creating new client', async () => {
        fsMock.existsSync.mockReturnValueOnce(true);
        const { initializeClientForTeacher } = await getCleanService();

        await initializeClientForTeacher('teacherH');
        await initializeClientForTeacher('teacherH', true);

        expect(fsMock.rmSync).toHaveBeenCalledWith(
            expect.stringContaining('session-session-teacherH'),
            expect.objectContaining({ recursive: true }),
        );
    });

    it('does NOT delete session folder if it does not exist', async () => {
        fsMock.existsSync.mockReturnValue(false);
        const { initializeClientForTeacher } = await getCleanService();

        await initializeClientForTeacher('teacherI');
        await initializeClientForTeacher('teacherI', true);

        expect(fsMock.rmSync).not.toHaveBeenCalled();
    });
});

describe('getClientStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns disconnected when no entry in pool', async () => {
        const { getClientStatus } = await getCleanService();
        expect(getClientStatus('unknown-teacher')).toBe('disconnected');
    });

    it('returns initializing while client is not yet ready', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();
        await initializeClientForTeacher('teacherJ');
        expect(getClientStatus('teacherJ')).toBe('initializing');
    });

    it('returns connected after ready event', async () => {
        const { initializeClientForTeacher, getClientStatus } = await getCleanService();
        await initializeClientForTeacher('teacherK');
        fakeClient.emit('ready');
        expect(getClientStatus('teacherK')).toBe('connected');
    });
});

describe('sendWhatsAppMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('throws when client is not in pool', async () => {
        const { sendWhatsAppMessage } = await getCleanService();
        await expect(sendWhatsAppMessage('01012345678', 'hello', 'noSuchTeacher'))
            .rejects.toThrow('not ready');
    });

    it('throws when client exists but is not ready (still initializing)', async () => {
        const { initializeClientForTeacher, sendWhatsAppMessage } = await getCleanService();
        await initializeClientForTeacher('teacherL');

        await expect(sendWhatsAppMessage('01012345678', 'hello', 'teacherL'))
            .rejects.toThrow('not ready');
    });

    it('sends message to normalized chatId when client is ready', async () => {
        const { initializeClientForTeacher, sendWhatsAppMessage } = await getCleanService();
        await initializeClientForTeacher('teacherM');
        fakeClient.emit('ready');

        await sendWhatsAppMessage('01012345678', 'مرحباً', 'teacherM');

        expect(fakeClient.sendMessage).toHaveBeenCalledWith(
            '201012345678@c.us',
            'مرحباً',
        );
    });

    it('wraps "Failed to send message" error as BLOCKED', async () => {
        const { initializeClientForTeacher, sendWhatsAppMessage } = await getCleanService();
        await initializeClientForTeacher('teacherN');
        fakeClient.emit('ready');

        fakeClient.sendMessage.mockRejectedValueOnce(new Error('Failed to send message'));

        await expect(sendWhatsAppMessage('01012345678', 'test', 'teacherN'))
            .rejects.toThrow('BLOCKED:');
    });
});

describe('destroyClientForTeacher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('is a no-op when teacher has no pool entry', async () => {
        const { destroyClientForTeacher } = await getCleanService();
        await expect(destroyClientForTeacher('nobody')).resolves.toBeUndefined();
    });

    it('calls logout then destroy on the client', async () => {
        const { initializeClientForTeacher, destroyClientForTeacher } = await getCleanService();
        await initializeClientForTeacher('teacherO');

        await destroyClientForTeacher('teacherO');

        expect(fakeClient.logout).toHaveBeenCalled();
        expect(fakeClient.destroy).toHaveBeenCalled();
    });

    it('removes pool entry and releases init lock', async () => {
        const { initializeClientForTeacher, destroyClientForTeacher, getClientStatus } = await getCleanService();
        await initializeClientForTeacher('teacherP');
        expect(getClientStatus('teacherP')).toBe('initializing');

        await destroyClientForTeacher('teacherP');
        expect(getClientStatus('teacherP')).toBe('disconnected');
    });

    it('deletes session folder using correct double-prefix path', async () => {
        const { destroyClientForTeacher } = await getCleanService();

        await destroyClientForTeacher('teacherQ');

        expect(rmMock).toHaveBeenCalledWith(
            expect.stringContaining('session-session-teacherQ'),
            expect.objectContaining({ recursive: true, force: true }),
        );
    });

    it('does not throw even if logout fails', async () => {
        const { initializeClientForTeacher, destroyClientForTeacher } = await getCleanService();
        await initializeClientForTeacher('teacherR');
        fakeClient.logout.mockRejectedValueOnce(new Error('already logged out'));

        await expect(destroyClientForTeacher('teacherR')).resolves.toBeUndefined();
    });
});

describe('autoReconnectClients', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTeachersResult = [];
    });

    it('does nothing when no connected teachers found in DB', async () => {
        mockTeachersResult = [];
        const { autoReconnectClients } = await getCleanService();

        await autoReconnectClients();

        expect(userModelMock.find).toHaveBeenCalledWith(
            { whatsappStatus: 'connected', role: 'teacher' },
            { _id: 1 },
        );
    });

    it('skips teachers whose session folder does not exist on disk', async () => {
        mockTeachersResult = [{ _id: 'teacherS' }];
        fsMock.existsSync.mockReturnValue(false);

        const { autoReconnectClients } = await getCleanService();
        await autoReconnectClients();

        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherS' },
            expect.objectContaining({ whatsappStatus: 'disconnected', whatsappQr: null }),
        );
    });

    it('initializes client for teachers whose session folder exists', async () => {
        mockTeachersResult = [{ _id: 'teacherT' }];
        fsMock.existsSync.mockReturnValue(true);

        const { autoReconnectClients, getClientStatus } = await getCleanService();
        await autoReconnectClients();

        expect(getClientStatus('teacherT')).toBe('initializing');
    });

    it('processes multiple teachers, skipping those without sessions', async () => {
        mockTeachersResult = [
            { _id: 'teacherU' },
            { _id: 'teacherV' },
        ];
        fsMock.existsSync
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(false);

        const { autoReconnectClients, getClientStatus } = await getCleanService();
        await autoReconnectClients();

        expect(getClientStatus('teacherU')).toBe('initializing');
        expect(getClientStatus('teacherV')).toBe('disconnected');
        expect(userModelMock.updateOne).toHaveBeenCalledWith(
            { _id: 'teacherV' },
            expect.objectContaining({ whatsappStatus: 'disconnected' }),
        );
    });
});
