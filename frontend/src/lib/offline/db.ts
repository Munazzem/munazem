/**
 * frontend/src/lib/offline/db.ts
 *
 * Lightweight, zero-dependency, promise-wrapped IndexedDB layer
 * for Munazem offline write persistence.
 */

const DB_NAME = 'munazem_offline_db';
const DB_VERSION = 1;
export const OUTBOX_STORE = 'attendance_outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

export function getOfflineDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('IndexedDB is only available in browser environment'));
    }

    if (!dbPromise) {
        dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
                    const store = db.createObjectStore(OUTBOX_STORE, { keyPath: 'clientMutationId' });
                    store.createIndex('sessionId', 'sessionId', { unique: false });
                    store.createIndex('syncStatus', 'syncStatus', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };
        });
    }

    return dbPromise;
}
