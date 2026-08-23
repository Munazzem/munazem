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

        for (const [sId, items] of sessionGroups.entries()) {
            const clientMutationIds = items.map(i => i.clientMutationId);
            await OutboxService.markMutationsSyncing(clientMutationIds);

            const records: SyncAttendanceRecordDTO[] = items.map(i => ({
                clientMutationId: i.clientMutationId,
                // Pass whichever identifier is available:
                //   studentId (ObjectId) — online or local-cache-resolved scan
                //   rawToken             — offline scan with no local match; server resolves
                ...(i.studentId ? { studentId: i.studentId } : {}),
                ...(i.rawToken  ? { rawToken:  i.rawToken  } : {}),
                status:       i.status,
                isGuest:      i.isGuest,
                homeworkDone: i.homeworkDone ?? undefined,
                scannedAt:    i.scannedAt,
                notes:        i.notes,
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
                const errorMsg = err?.response?.data?.message || err?.message || 'خطأ في الاتصال بالخادم';
                await OutboxService.markMutationsFailed(clientMutationIds, errorMsg);
                totalFailed += records.length;
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
