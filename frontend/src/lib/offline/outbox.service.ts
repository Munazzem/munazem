/**
 * frontend/src/lib/offline/outbox.service.ts
 *
 * CRUD operations for offline attendance outbox mutations in IndexedDB.
 */

import { getOfflineDB, OUTBOX_STORE } from './db';
import type { IOfflineOutboxMutation } from '@/types/session.types';

export class OutboxService {
    /**
     * Enqueue a new attendance mutation or update an existing one.
     */
    static async enqueueAttendance(mutation: IOfflineOutboxMutation): Promise<void> {
        try {
            const db = await getOfflineDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readwrite');
                const store = tx.objectStore(OUTBOX_STORE);
                const req = store.put(mutation);

                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Failed to enqueue offline attendance mutation:', error);
        }
    }

    /**
     * Get all un-synced mutations (status != 'RESOLVED').
     */
    static async getPendingMutations(sessionId?: string): Promise<IOfflineOutboxMutation[]> {
        try {
            const db = await getOfflineDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readonly');
                const store = tx.objectStore(OUTBOX_STORE);
                const req = store.getAll();

                req.onsuccess = () => {
                    const all: IOfflineOutboxMutation[] = req.result || [];
                    const filtered = all.filter(m => {
                        const isPending = m.syncStatus === 'QUEUED' || (m.syncStatus === 'FAILED' && (m.retryCount || 0) < 5);
                        const matchesSession = sessionId ? m.sessionId === sessionId : true;
                        return isPending && matchesSession;
                    });
                    // Sort FIFO by createdAt
                    filtered.sort((a, b) => a.createdAt - b.createdAt);
                    resolve(filtered);
                };
                req.onerror = () => reject(req.error);
            });
        } catch (error) {
            console.error('Failed to get pending mutations from outbox:', error);
            return [];
        }
    }

    /**
     * Mark a batch of mutations as SYNCING.
     */
    static async markMutationsSyncing(clientMutationIds: string[]): Promise<void> {
        if (clientMutationIds.length === 0) return;
        try {
            const db = await getOfflineDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readwrite');
                const store = tx.objectStore(OUTBOX_STORE);

                clientMutationIds.forEach(id => {
                    const getReq = store.get(id);
                    getReq.onsuccess = () => {
                        if (getReq.result) {
                            const updated: IOfflineOutboxMutation = {
                                ...getReq.result,
                                syncStatus: 'SYNCING',
                            };
                            store.put(updated);
                        }
                    };
                });

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('Failed to mark mutations as syncing:', error);
        }
    }

    /**
     * Remove successfully synced mutations from IndexedDB.
     */
    static async removeResolvedMutations(clientMutationIds: string[]): Promise<void> {
        if (clientMutationIds.length === 0) return;
        try {
            const db = await getOfflineDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readwrite');
                const store = tx.objectStore(OUTBOX_STORE);

                clientMutationIds.forEach(id => {
                    store.delete(id);
                });

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('Failed to remove resolved mutations:', error);
        }
    }

    /**
     * Mark a batch of mutations as FAILED with error context.
     */
    static async markMutationsFailed(clientMutationIds: string[], errorMsg: string): Promise<void> {
        if (clientMutationIds.length === 0) return;
        try {
            const db = await getOfflineDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readwrite');
                const store = tx.objectStore(OUTBOX_STORE);

                clientMutationIds.forEach(id => {
                    const getReq = store.get(id);
                    getReq.onsuccess = () => {
                        if (getReq.result) {
                            const updated: IOfflineOutboxMutation = {
                                ...getReq.result,
                                syncStatus: 'FAILED',
                                retryCount: (getReq.result.retryCount || 0) + 1,
                                lastError: errorMsg,
                            };
                            store.put(updated);
                        }
                    };
                });

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('Failed to mark mutations as failed:', error);
        }
    }

    /**
     * Get pending count for a session or globally.
     */
    static async getPendingCount(sessionId?: string): Promise<number> {
        const pending = await this.getPendingMutations(sessionId);
        return pending.length;
    }

    /**
     * Prune old records older than 7 days.
     */
    static async pruneOldEntries(): Promise<void> {
        try {
            const db = await getOfflineDB();
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

            return new Promise((resolve, reject) => {
                const tx = db.transaction(OUTBOX_STORE, 'readwrite');
                const store = tx.objectStore(OUTBOX_STORE);
                const req = store.getAll();

                req.onsuccess = () => {
                    const all: IOfflineOutboxMutation[] = req.result || [];
                    all.forEach(item => {
                        if (item.createdAt < sevenDaysAgo) {
                            store.delete(item.clientMutationId);
                        }
                    });
                };

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('Failed to prune old outbox entries:', error);
        }
    }
}
