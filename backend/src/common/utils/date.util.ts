/**
 * Centralized date & timezone utilities for Monazem.
 *
 * Egypt has been on permanent UTC+3 (no DST) since 2014.
 * All helpers here use this fixed offset.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Egypt timezone offset in milliseconds (UTC+3, no DST since 2014) */
export const EGYPT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Arabic day name → JS getUTCDay() (0 = Sunday, 6 = Saturday) */
export const DAY_MAP: Record<string, number> = {
    'الأحد':     0,
    'الاحد':     0,
    'الاثنين':   1,
    'الإثنين':   1,
    'الثلاثاء':  2,
    'الأربعاء':  3,
    'الاربعاء':  3,
    'الخميس':    4,
    'الجمعة':    5,
    'السبت':     6,
};

// ─── Date Helpers ────────────────────────────────────────────────────────────

/**
 * Maps any timestamp to midnight UTC of the day it falls on in Egypt timezone.
 *
 * Example: 10 PM Egypt time (19:00 UTC) on May 18 → May 18 00:00:00 UTC.
 * Example: 1 AM Egypt time (22:00 UTC prev day) on May 19 → May 19 00:00:00 UTC.
 *
 * Returns a Date object (used by payments & ledger services).
 */
export function startOfDayEgypt(date: Date): Date {
    const local = new Date(date.getTime() + EGYPT_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Same as startOfDayEgypt but returns milliseconds.
 * Used by attendance service for numeric comparisons.
 */
export function startOfDayEgyptMs(date: Date): number {
    const local = new Date(date.getTime() + EGYPT_OFFSET_MS);
    local.setUTCHours(0, 0, 0, 0);
    return local.getTime() - EGYPT_OFFSET_MS;
}

/**
 * Returns "today" as YYYY-MM-DD string in Egypt timezone.
 */
export function todayEgypt(): string {
    const egyptNow = new Date(Date.now() + EGYPT_OFFSET_MS);
    return egyptNow.toISOString().split('T')[0]!;
}

/**
 * Returns Egypt midnight boundaries for a given date (y, m, d).
 * Used for daily summary queries where we need to match Egypt-local day boundaries
 * against UTC-stored timestamps.
 *
 * dayStart = midnight Egypt time as UTC
 * dayEnd   = 23:59:59.999 Egypt time as UTC
 */
export function egyptDayBounds(y: number, m: number, d: number) {
    const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - EGYPT_OFFSET_MS);
    const dayEnd   = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - EGYPT_OFFSET_MS);
    return { dayStart, dayEnd };
}

/**
 * Resolves a transaction date string to a precise Date object.
 * - No input → current time
 * - ISO string (has 'T') → parse directly
 * - YYYY-MM-DD and equals today in Egypt → exact current time
 * - YYYY-MM-DD backdated → 12:00 PM (Noon) Egypt time to avoid 3 AM weirdness
 */
export function resolveTransactionDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);

    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const now = new Date();
        const egyptNow = new Date(now.getTime() + EGYPT_OFFSET_MS);
        const todayStr = egyptNow.toISOString().split('T')[0];

        if (dateStr === todayStr) {
            return now; // exact current time
        } else {
            // Noon Egypt time (09:00 UTC)
            return new Date(Date.UTC(Number(parts[0]), Number(parts[1]!) - 1, Number(parts[2]), 9, 0, 0, 0));
        }
    }
    return new Date(dateStr);
}
