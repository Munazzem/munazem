/**
 * frontend/src/lib/store/offline-sync.store.ts
 *
 * Zustand store for managing offline attendance outbox synchronization state.
 */

import { create } from 'zustand';
import { OutboxService } from '@/lib/offline/outbox.service';
import { syncBatchAttendance } from '@/lib/api/attendance';
import type { SyncAttendanceRecordDTO } from '@/types/session.types';

interface OfflineSyncState {
    pendingCount: number;
    isSyncing: boolean;
    failedCount: number;
    lastSyncTime: Date | null;
    refreshPendingCount: (sessionId?: string) => Promise<void>;
    flushQueue: (sessionId?: string, onSuccess?: () => void) => Promise<{ synced: number; failed: number }>;
}

export const useOfflineSyncStore = create<OfflineSyncState>((set, get) => ({
    pendingCount: 0,
    isSyncing: false,
    failedCount: 0,
    lastSyncTime: null,

    refreshPendingCount: async (sessionId?: string) => {
        const count = await OutboxService.getPendingCount(sessionId);
        set({ pendingCount: count });
    },

    flushQueue: async (sessionId?: string, onSuccess?: () => void) => {
        if (get().isSyncing) return { synced: 0, failed: 0 };
        if (typeof window !== 'undefined' && !navigator.onLine) {
            return { synced: 0, failed: 0 };
        }

        const pending = await OutboxService.getPendingMutations(sessionId);
        if (pending.length === 0) {
            set({ pendingCount: 0, isSyncing: false });
            return { synced: 0, failed: 0 };
        }

        set({ isSyncing: true });
        let totalSynced = 0;
        let totalFailed = 0;

        // Group pending mutations by sessionId
        const sessionGroups = new Map<string, typeof pending>();
        for (const item of pending) {
            const list = sessionGroups.get(item.sessionId) || [];
            list.push(item);
            sessionGroups.set(item.sessionId, list);
        }

        const CHUNK_SIZE = 25;
        for (const [sId, items] of sessionGroups.entries()) {
            if (typeof window !== 'undefined' && !navigator.onLine) break;

            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                if (typeof window !== 'undefined' && !navigator.onLine) break;

                const chunk = items.slice(i, i + CHUNK_SIZE);
                const clientMutationIds = chunk.map(c => c.clientMutationId);
                await OutboxService.markMutationsSyncing(clientMutationIds);

                const records: SyncAttendanceRecordDTO[] = chunk.map(c => ({
                    clientMutationId: c.clientMutationId,
                    ...(c.studentId ? { studentId: c.studentId } : {}),
                    ...(c.rawToken  ? { rawToken:  c.rawToken  } : {}),
                    status:       c.status,
                    isGuest:      c.isGuest,
                    homeworkDone: c.homeworkDone ?? undefined,
                    scannedAt:    c.scannedAt,
                    notes:        c.notes,
                }));

                try {
                    const res = await syncBatchAttendance(sId, records);
                    if (res.success) {
                        await OutboxService.removeResolvedMutations(clientMutationIds);
                        totalSynced += records.length;
                    } else {
                        await OutboxService.markMutationsFailed(clientMutationIds, res.message || 'فشلت المزامنة');
                        totalFailed += records.length;
                    }
                } catch (err: any) {
                    const status = err?.response?.status;
                    const errorMsg = err?.response?.data?.message || err?.message || 'خطأ في الاتصال بالخادم';
                    await OutboxService.markMutationsFailed(clientMutationIds, errorMsg);
                    totalFailed += records.length;

                    // If rate limited or server overloaded, stop hammering this pass
                    if (status === 429 || (status >= 500 && status < 600)) {
                        break;
                    }
                }

                // Breathing room delay (250ms) between chunks to avoid server load spikes
                if (i + CHUNK_SIZE < items.length) {
                    await new Promise(r => setTimeout(r, 250));
                }
            }
        }

        const remaining = await OutboxService.getPendingCount(sessionId);
        set({
            pendingCount: remaining,
            isSyncing: false,
            lastSyncTime: new Date(),
            failedCount: totalFailed,
        });

        if (totalSynced > 0 && onSuccess) {
            onSuccess();
        }

        return { synced: totalSynced, failed: totalFailed };
    },
}));
