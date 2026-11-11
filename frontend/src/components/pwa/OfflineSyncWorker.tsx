/**
 * frontend/src/components/pwa/OfflineSyncWorker.tsx
 *
 * Headless background worker that monitors network status and
 * automatically flushes:
 * 1. Attendance outbox records.
 * 2. Generic offline CRUD mutations (created/edited students, payments, exam results, sessions).
 * when connection is restored.
 */

'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineSyncStore } from '@/lib/store/offline-sync.store';
import { OutboxService } from '@/lib/offline/outbox.service';
import { OfflineStorageService } from '@/lib/offline/storage.service';
import { apiClient } from '@/lib/api/axios';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from 'sonner';

export function OfflineSyncWorker() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const flushQueue = useOfflineSyncStore((s) => s.flushQueue);
    const refreshPendingCount = useOfflineSyncStore((s) => s.refreshPendingCount);
    const isSyncingRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Prune old outbox entries on initial startup
        OutboxService.pruneOldEntries().catch(() => {});
        refreshPendingCount().catch(() => {});

        const handleSync = async () => {
            if (typeof window === 'undefined' || !navigator.onLine || isSyncingRef.current) return;

            try {
                isSyncingRef.current = true;

                // 1. Flush Attendance Outbox
                const currentPending = useOfflineSyncStore.getState().pendingCount;
                if (currentPending > 0) {
                    const { synced } = await flushQueue(undefined, () => {
                        queryClient.invalidateQueries({ queryKey: ['attendance'] });
                    });
                    if (synced > 0) {
                        toast.success(`تمت مزامنة ${synced} سجل حضور معلق مع السيرفر بنجاح`);
                    }
                }

                // 2. Flush Generic CRUD Mutations (Students, Payments, Sessions, Exam Results)
                const genericMutations = await OfflineStorageService.getPendingGenericMutations();
                if (genericMutations.length > 0) {
                    let syncedMutations = 0;
                    // Cap per-pass batch size to 20 to avoid long blocking locks
                    const batchToProcess = genericMutations.slice(0, 20);

                    for (const mut of batchToProcess) {
                        if (!navigator.onLine) break;

                        try {
                            await apiClient.request({
                                url: mut.url,
                                method: mut.method,
                                data: mut.data,
                                headers: { 'x-skip-offline-adapter': 'true' },
                            });
                            await OfflineStorageService.removeGenericMutation(mut.id);
                            syncedMutations++;

                            // Controlled pacing delay: 350ms pause between each mutation request
                            // Protects server from connection spikes and database locks
                            await new Promise((r) => setTimeout(r, 350));
                        } catch (err: any) {
                            const status = err?.response?.status;
                            console.error('[OfflineSyncWorker] Failed to sync mutation:', mut, err);
                            await OfflineStorageService.markGenericMutationFailed(mut.id, err?.message);

                            // Server protection: if 429 (Rate Limit) or 5xx (Server Overload), stop immediately
                            if (status === 429 || (status >= 500 && status < 600)) {
                                console.warn('[OfflineSyncWorker] Server throttle or overload detected, pausing mutation sync pass.');
                                break;
                            }
                        }
                    }

                    if (syncedMutations > 0) {
                        toast.success(`تمت مزامنة ${syncedMutations} عملية مع الخادم تدريجياً وبنجاح`);
                        // Refresh ledgers and entities so temporary local IDs are cleanly updated
                        queryClient.invalidateQueries();
                    }
                }
            } catch (err) {
                console.error('[OfflineSyncWorker] Sync loop error:', err);
            } finally {
                isSyncingRef.current = false;
            }
        };

        const handleOnline = () => {
            console.log('🌐 Network restored: Triggering full offline mutations flush...');
            handleSync();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleSync();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic background interval
        const intervalId = setInterval(() => {
            handleSync();
        }, 15000);

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);
        };
    }, [isAuthenticated, flushQueue, refreshPendingCount, queryClient]);

    return null;
}
