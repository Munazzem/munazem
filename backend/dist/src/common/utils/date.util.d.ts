/**
 * Centralized date & timezone utilities for Monazem.
 *
 * Egypt has been on permanent UTC+3 (no DST) since 2014.
 * All helpers here use this fixed offset.
 */
/** Egypt timezone offset in milliseconds (UTC+3, no DST since 2014) */
export declare const EGYPT_OFFSET_MS: number;
/** Arabic day name → JS getUTCDay() (0 = Sunday, 6 = Saturday) */
export declare const DAY_MAP: Record<string, number>;
/**
 * Maps any timestamp to midnight UTC of the day it falls on in Egypt timezone.
 *
 * Example: 10 PM Egypt time (19:00 UTC) on May 18 → May 18 00:00:00 UTC.
 * Example: 1 AM Egypt time (22:00 UTC prev day) on May 19 → May 19 00:00:00 UTC.
 *
 * Returns a Date object (used by payments & ledger services).
 */
export declare function startOfDayEgypt(date: Date): Date;
/**
 * Same as startOfDayEgypt but returns milliseconds.
 * Used by attendance service for numeric comparisons.
 */
export declare function startOfDayEgyptMs(date: Date): number;
/**
 * Returns "today" as YYYY-MM-DD string in Egypt timezone.
 */
export declare function todayEgypt(): string;
/**
 * Returns Egypt midnight boundaries for a given date (y, m, d).
 * Used for daily summary queries where we need to match Egypt-local day boundaries
 * against UTC-stored timestamps.
 *
 * dayStart = midnight Egypt time as UTC
 * dayEnd   = 23:59:59.999 Egypt time as UTC
 */
export declare function egyptDayBounds(y: number, m: number, d: number): {
    dayStart: Date;
    dayEnd: Date;
};
/**
 * Resolves a transaction date string to a precise Date object.
 * - No input → current time
 * - ISO string (has 'T') → parse directly
 * - YYYY-MM-DD and equals today in Egypt → exact current time
 * - YYYY-MM-DD backdated → 12:00 PM (Noon) Egypt time to avoid 3 AM weirdness
 */
export declare function resolveTransactionDate(dateStr?: string): Date;
//# sourceMappingURL=date.util.d.ts.map