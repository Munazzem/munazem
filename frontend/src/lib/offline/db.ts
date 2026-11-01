/**
 * frontend/src/lib/offline/db.ts
 *
 * Lightweight, zero-dependency, promise-wrapped IndexedDB layer
 * for Munazem offline write persistence and local data caching.
 */

const DB_NAME = 'munazem_offline_db';
const DB_VERSION = 6;

export const STORES = {
    OUTBOX: 'attendance_outbox',
    MUTATIONS: 'generic_mutations_outbox',
    STUDENTS: 'students',
    STUDENT_REPORTS: 'student_reports',
    GROUPS: 'groups',
    SESSIONS: 'sessions',
    ATTENDANCE: 'attendance_records',
    EXAMS: 'exams',
    EXAM_RESULTS: 'exam_results',
    NOTEBOOKS: 'notebooks',
    NOTEBOOK_RESERVATIONS: 'notebook_reservations',
    USERS: 'users',
    CENTERS: 'centers',
    CENTER_TEACHERS: 'center_teachers',
    CENTER_PACKAGES: 'center_packages',
    CENTER_GROUPS: 'center_groups',
    CENTER_STUDENTS: 'center_students',
    CENTER_ENROLLMENTS: 'center_enrollments',
    CENTER_ATTENDANCE: 'center_attendance',
    CENTER_CHECKINS: 'center_checkins',
    CENTER_SUPERVISORS: 'center_supervisors',
    CENTER_FINANCIALS: 'center_financials',
    KEYVAL: 'keyval',
} as const;

export const OUTBOX_STORE = STORES.OUTBOX;

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

                // 1. Attendance Outbox (Writes)
                if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
                    const store = db.createObjectStore(STORES.OUTBOX, { keyPath: 'clientMutationId' });
                    store.createIndex('sessionId', 'sessionId', { unique: false });
                    store.createIndex('syncStatus', 'syncStatus', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 2. Generic Mutations Outbox (CRUD Writes: Students, Payments, Sessions, Exam Grades)
                if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
                    const store = db.createObjectStore(STORES.MUTATIONS, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }

                // 3. Students Cache (Reads & Offline Resolution)
                if (!db.objectStoreNames.contains(STORES.STUDENTS)) {
                    const store = db.createObjectStore(STORES.STUDENTS, { keyPath: '_id' });
                    store.createIndex('studentCode', 'studentCode', { unique: false });
                    store.createIndex('studentPhone', 'studentPhone', { unique: false });
                    store.createIndex('groupId', 'groupId', { unique: false });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                }

                // 4. Student Comprehensive Reports Cache (Profile, Attendance, Payments, Grades)
                if (!db.objectStoreNames.contains(STORES.STUDENT_REPORTS)) {
                    db.createObjectStore(STORES.STUDENT_REPORTS, { keyPath: 'studentId' });
                }

                // 5. Groups Cache
                if (!db.objectStoreNames.contains(STORES.GROUPS)) {
                    const store = db.createObjectStore(STORES.GROUPS, { keyPath: '_id' });
                    store.createIndex('stage', 'stage', { unique: false });
                    store.createIndex('day', 'day', { unique: false });
                }

                // 6. Sessions Cache
                if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                    const store = db.createObjectStore(STORES.SESSIONS, { keyPath: '_id' });
                    store.createIndex('groupId', 'groupId', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }

                // 7. Attendance Records Cache
                if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
                    const store = db.createObjectStore(STORES.ATTENDANCE, { keyPath: '_id' });
                    store.createIndex('sessionId', 'sessionId', { unique: false });
                    store.createIndex('studentId', 'studentId', { unique: false });
                }

                // 8. Exams Cache
                if (!db.objectStoreNames.contains(STORES.EXAMS)) {
                    const store = db.createObjectStore(STORES.EXAMS, { keyPath: '_id' });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }

                // 9. Exam Results & Grades Cache
                if (!db.objectStoreNames.contains(STORES.EXAM_RESULTS)) {
                    db.createObjectStore(STORES.EXAM_RESULTS, { keyPath: 'examId' });
                }

                // 10. Notebooks Cache (المتجر والمذكرات)
                if (!db.objectStoreNames.contains(STORES.NOTEBOOKS)) {
                    const store = db.createObjectStore(STORES.NOTEBOOKS, { keyPath: '_id' });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                }

                // 11. Notebook Reservations Cache (حجوزات المذكرات)
                if (!db.objectStoreNames.contains(STORES.NOTEBOOK_RESERVATIONS)) {
                    db.createObjectStore(STORES.NOTEBOOK_RESERVATIONS, { keyPath: '_id' });
                }

                // 12. Users & Assistants Cache (المساعدين والمستخدمين)
                if (!db.objectStoreNames.contains(STORES.USERS)) {
                    const store = db.createObjectStore(STORES.USERS, { keyPath: '_id' });
                    store.createIndex('role', 'role', { unique: false });
                }

                // 13. Centers Cache (السناتر والفروع)
                if (!db.objectStoreNames.contains(STORES.CENTERS)) {
                    db.createObjectStore(STORES.CENTERS, { keyPath: '_id' });
                }

                // 14. Center Teachers (مدرسي السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_TEACHERS)) {
                    const store = db.createObjectStore(STORES.CENTER_TEACHERS, { keyPath: '_id' });
                    store.createIndex('isActive', 'isActive', { unique: false });
                }

                // 15. Center Packages (باقات السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_PACKAGES)) {
                    const store = db.createObjectStore(STORES.CENTER_PACKAGES, { keyPath: '_id' });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                }

                // 16. Center Groups (مجموعات السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_GROUPS)) {
                    const store = db.createObjectStore(STORES.CENTER_GROUPS, { keyPath: '_id' });
                    store.createIndex('centerTeacherId', 'centerTeacherId', { unique: false });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                    store.createIndex('groupType', 'groupType', { unique: false });
                }

                // 17. Center Students (طلاب السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_STUDENTS)) {
                    const store = db.createObjectStore(STORES.CENTER_STUDENTS, { keyPath: '_id' });
                    store.createIndex('studentCode', 'studentCode', { unique: false });
                    store.createIndex('studentPhone', 'studentPhone', { unique: false });
                    store.createIndex('barcode', 'barcode', { unique: false });
                    store.createIndex('gradeLevel', 'gradeLevel', { unique: false });
                    store.createIndex('stage', 'stage', { unique: false });
                }

                // 18. Center Enrollments (اشتراكات طلاب السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_ENROLLMENTS)) {
                    const store = db.createObjectStore(STORES.CENTER_ENROLLMENTS, { keyPath: '_id' });
                    store.createIndex('studentId', 'studentId', { unique: false });
                    store.createIndex('packageId', 'packageId', { unique: false });
                }

                // 19. Center Attendance Records (سجلات حضور الحصص بالسنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_ATTENDANCE)) {
                    const store = db.createObjectStore(STORES.CENTER_ATTENDANCE, { keyPath: '_id' });
                    store.createIndex('groupId', 'groupId', { unique: false });
                    store.createIndex('studentId', 'studentId', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }

                // 20. Center Gate Daily Check-Ins (تسجيل دخول بوابة السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_CHECKINS)) {
                    const store = db.createObjectStore(STORES.CENTER_CHECKINS, { keyPath: '_id' });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('studentId', 'studentId', { unique: false });
                }

                // 21. Center Supervisors (مشرفي السنتر)
                if (!db.objectStoreNames.contains(STORES.CENTER_SUPERVISORS)) {
                    db.createObjectStore(STORES.CENTER_SUPERVISORS, { keyPath: '_id' });
                }

                // 22. Center Financials (الجارد اليومي والشهري والملخصات)
                if (!db.objectStoreNames.contains(STORES.CENTER_FINANCIALS)) {
                    db.createObjectStore(STORES.CENTER_FINANCIALS, { keyPath: 'key' });
                }

                // 23. Key-Value Cache (Daily Summary, Ledgers, Prices, Metadata)
                if (!db.objectStoreNames.contains(STORES.KEYVAL)) {
                    db.createObjectStore(STORES.KEYVAL, { keyPath: 'key' });
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

// ── Generic IDB Key-Value Helpers ─────────────────────────────────────────────

export async function getKeyVal<T>(key: string): Promise<T | undefined> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.KEYVAL, 'readonly');
            const store = tx.objectStore(STORES.KEYVAL);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return undefined;
    }
}

export async function setKeyVal<T>(key: string, value: T): Promise<void> {
    const db = await getOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.KEYVAL, 'readwrite');
        const store = tx.objectStore(STORES.KEYVAL);
        const req = store.put({ key, value, updatedAt: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function deleteKeyVal(key: string): Promise<void> {
    const db = await getOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.KEYVAL, 'readwrite');
        const store = tx.objectStore(STORES.KEYVAL);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ── Generic Object Store Operations ───────────────────────────────────────────

export async function getAllFromStore<T>(storeName: string): Promise<T[]> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error(`[IDB] Failed to get all from store ${storeName}:`, err);
        return [];
    }
}

export async function getByIdFromStore<T>(storeName: string, id: string): Promise<T | undefined> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result || undefined);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return undefined;
    }
}

export async function putManyInStore<T>(storeName: string, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const item of items) {
                store.put(item);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.error(`[IDB] Failed to put items into store ${storeName}:`, err);
    }
}

export async function putOneInStore<T>(storeName: string, item: T): Promise<void> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error(`[IDB] Failed to put item into store ${storeName}:`, err);
    }
}

export async function deleteFromStore(storeName: string, id: string): Promise<void> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error(`[IDB] Failed to delete item ${id} from store ${storeName}:`, err);
    }
}

export async function countStore(storeName: string): Promise<number> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.count();
            req.onsuccess = () => resolve(req.result || 0);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return 0;
    }
}

export async function clearStore(storeName: string): Promise<void> {
    try {
        const db = await getOfflineDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.error(`[IDB] Failed to clear store ${storeName}:`, err);
    }
}

/**
 * Clears ALL offline data stores (including KEYVAL) to prevent cross-tenant data leaks.
 * Called on logout and when a different user account is detected on login.
 * Does NOT clear the attendance outbox or generic mutations to avoid losing pending writes.
 */
export async function clearAllOfflineData(preserveOutbox = true): Promise<void> {
    try {
        const db = await getOfflineDB();

        // Determine which stores to clear
        const allStores = Object.values(STORES);
        const storesToClear = preserveOutbox
            ? allStores.filter(s => s !== STORES.OUTBOX && s !== STORES.MUTATIONS)
            : allStores;

        // Use separate transactions per store for maximum mobile compatibility (iOS Safari)
        for (const storeName of storesToClear) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const tx = db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    const req = store.clear();
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                    tx.onerror = () => reject(tx.error);
                });
            } catch (storeErr) {
                console.warn(`[IDB] Failed to clear store ${storeName}:`, storeErr);
            }
        }

        console.log('[IDB] ✅ All offline data cleared (cross-tenant protection active).');
    } catch (err) {
        console.error('[IDB] clearAllOfflineData failed:', err);
        // Last resort: try to delete and recreate the entire database
        try {
            if (dbPromise) {
                try {
                    const existingDb = await dbPromise;
                    existingDb.close();
                } catch {
                    // ignore
                }
            }
            dbPromise = null;
            await new Promise<void>((resolve, reject) => {
                const req = window.indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
                req.onblocked = () => {
                    console.warn('[IDB] deleteDatabase blocked by open connection, resolving anyway.');
                    resolve();
                };
            });
            console.log('[IDB] Database deleted and will be recreated on next access.');
        } catch (deleteErr) {
            console.error('[IDB] Failed to delete database:', deleteErr);
        }
    }
}

