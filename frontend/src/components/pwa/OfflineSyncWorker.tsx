/**
 * frontend/src/components/pwa/OfflineSyncWorker.tsx
 *
 * Headless background worker that monitors network status and
 * automatically flushes the IndexedDB attendance outbox when connection is restored.
 */

'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOfflineSyncStore } from '@/lib/store/offline-sync.store';
import { OutboxService } from '@/lib/offline/outbox.service';
import { useAuthStore } from '@/lib/store/auth.store';
import { toast } from 'sonner';

export function OfflineSyncWorker() {
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const flushQueue = useOfflineSyncStore((s) => s.flushQueue);
    const refreshPendingCount = useOfflineSyncStore((s) => s.refreshPendingCount);
    const pendingCount = useOfflineSyncStore((s) => s.pendingCount);

    useEffect(() => {
        if (!isAuthenticated) return;

        // Prune old outbox entries on initial startup
        OutboxService.pruneOldEntries().catch(() => {});
        refreshPendingCount().catch(() => {});

        const handleSync = async () => {
            if (navigator.onLine) {
                const { synced } = await flushQueue(undefined, () => {
                    queryClient.invalidateQueries({ queryKey: ['attendance'] });
                });
                if (synced > 0) {
                    toast.success(`تمت مزامنة ${synced} سجل حضور معلق مع السيرفر بنجاح`);
                }
            }
        };

        const handleOnline = () => {
            console.log('🌐 Network restored: Triggering outbox flush...');
            handleSync();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleSync();
            }
        };

        window.addEventListener('online', handleOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Periodic background interval when there are pending items
        const intervalId = setInterval(() => {
            if (navigator.onLine && pendingCount > 0) {
                handleSync();
            }
        }, 15000);

        return () => {
            window.removeEventListener('online', handleOnline);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId);
        };
    }, [isAuthenticated, flushQueue, refreshPendingCount, pendingCount, queryClient]);

    return null;
}
