/**
 * Centralized date & timezone utilities for Monazem.
 *
 * All business calendar & day calculations are anchored to Africa/Cairo.
 * Egypt observes Daylight Saving Time (UTC+3 in summer, UTC+2 in winter).
 * Calculations use native Intl.DateTimeFormat for accuracy across all months.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

export const EGYPT_TIMEZONE = 'Africa/Cairo';

/** Egypt timezone offset in milliseconds for backward compatibility */
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

const cairoFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
});

// ─── Date Helpers ────────────────────────────────────────────────────────────

/**
 * Extracts year, month (1-12), day (1-31), hour, minute, second in Africa/Cairo timezone.
 */
export function getEgyptParts(date: Date = new Date()) {
    const parts = cairoFormatter.formatToParts(date);
    const map: Record<string, number> = {};
    for (const p of parts) {
        if (p.type !== 'literal') {
            map[p.type] = parseInt(p.value, 10);
        }
    }
    const hour = map.hour === 24 ? 0 : (map.hour ?? 0);
    return {
        year: map.year ?? date.getUTCFullYear(),
        month: map.month ?? (date.getUTCMonth() + 1),
        day: map.day ?? date.getUTCDate(),
        hour,
        minute: map.minute ?? 0,
        second: map.second ?? 0
    };
}

/**
 * Returns { year, month } representing the business year and month (1-12) in Africa/Cairo.
 * Used by MonthlyLedger to prevent UTC midnight leakage across month boundaries.
 */
export function getEgyptYearMonth(date: Date = new Date()): { year: number; month: number } {
    const { year, month } = getEgyptParts(date);
    return { year, month };
}

/**
 * Maps any timestamp to midnight UTC of the day it falls on in Africa/Cairo timezone.
 * Example: 10 PM Egypt time (19:00 UTC) on May 18 → May 18 00:00:00 UTC.
 * Example: 1 AM Egypt time (22:00 UTC prev day) on May 19 → May 19 00:00:00 UTC.
 *
 * Returns a Date object (used by payments & ledger services for daily grouping).
 */
export function startOfDayEgypt(date: Date = new Date()): Date {
    const { year, month, day } = getEgyptParts(date);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Returns midnight Egypt time in milliseconds (UTC timestamp of 00:00:00 Egypt).
 * Used by attendance service for numeric date comparisons.
 */
export function startOfDayEgyptMs(date: Date = new Date()): number {
    const local = new Date(date.getTime() + EGYPT_OFFSET_MS);
    local.setUTCHours(0, 0, 0, 0);
    return local.getTime() - EGYPT_OFFSET_MS;
}

/**
 * Returns "today" as YYYY-MM-DD string in Africa/Cairo timezone.
 */
export function todayEgypt(date: Date = new Date()): string {
    const { year, month, day } = getEgyptParts(date);
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

/**
 * Returns Cairo midnight boundaries for a given date (y, m, d).
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
 * - YYYY-MM-DD backdated → 12:00 PM (Noon) Egypt time (09:00 UTC)
 */
export function resolveTransactionDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    if (dateStr.includes('T')) return new Date(dateStr);

    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const now = new Date();
        const todayStr = todayEgypt(now);

        if (dateStr === todayStr) {
            return now;
        } else {
            // Noon Egypt time (09:00 UTC)
            return new Date(Date.UTC(Number(parts[0]), Number(parts[1]!) - 1, Number(parts[2]), 9, 0, 0, 0));
        }
    }
    return new Date(dateStr);
}
