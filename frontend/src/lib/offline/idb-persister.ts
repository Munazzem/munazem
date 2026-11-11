/**
 * frontend/src/lib/offline/idb-persister.ts
 *
 * IndexedDB persister for TanStack React Query.
 * Bypasses the 5MB localStorage limit and seamlessly migrates legacy cache.
 */

import { getKeyVal, setKeyVal, deleteKeyVal } from './db';

const PERSISTER_KEY = 'REACT_QUERY_OFFLINE_CACHE';

export interface IndexedDBPersisterOptions {
    key?: string;
    throttleTime?: number;
}

export function createIndexedDBPersister(options?: IndexedDBPersisterOptions) {
    const storageKey = options?.key || PERSISTER_KEY;
    const throttleTime = options?.throttleTime ?? 1000;

    let timeoutId: any = null;
    let latestClient: any = null;

    return {
        persistClient: async (persistClient: any) => {
            latestClient = persistClient;

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            return new Promise<void>((resolve) => {
                timeoutId = setTimeout(async () => {
                    try {
                        if (latestClient) {
                            await setKeyVal(storageKey, latestClient);
                        }
                    } catch (err) {
                        console.error('[IDB Persister] Failed to save React Query cache to IndexedDB:', err);
                    } finally {
                        timeoutId = null;
                        resolve();
                    }
                }, throttleTime);
            });
        },

        restoreClient: async () => {
            try {
                // 1. Try reading from IndexedDB first
                const data = await getKeyVal<any>(storageKey);
                if (data) {
                    return data;
                }

                // 2. Migration fallback: Check if legacy cache exists in localStorage
                if (typeof window !== 'undefined') {
                    const localData = window.localStorage.getItem(PERSISTER_KEY);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            await setKeyVal(storageKey, parsed);
                            window.localStorage.removeItem(PERSISTER_KEY);
                            console.log('[IDB Persister] Migrated React Query cache from localStorage to IndexedDB');
                            return parsed;
                        } catch {
                            window.localStorage.removeItem(PERSISTER_KEY);
                        }
                    }
                }

                return undefined;
            } catch (err) {
                console.error('[IDB Persister] Failed to restore React Query cache from IndexedDB:', err);
                return undefined;
            }
        },

        removeClient: async () => {
            try {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                latestClient = null;
                await deleteKeyVal(storageKey);
                if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(PERSISTER_KEY);
                }
            } catch (err) {
                console.error('[IDB Persister] Failed to remove React Query cache:', err);
            }
        },
    };
}
