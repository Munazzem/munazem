/**
 * Unified Formatting Utilities for Monazem
 * Ensures clean, modern English typography for numbers (0-9)
 * and beautiful Arabic language support with Latin digits (-u-nu-latn).
 */

export function formatNumber(value: number | string | undefined | null): string {
    if (value === undefined || value === null || value === '') return '0';
    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-US');
}

export function formatCurrency(value: number | string | undefined | null, unit: string = 'ج.م'): string {
    return `${formatNumber(value)} ${unit}`;
}

export const CAIRO_TIMEZONE = 'Africa/Cairo';

/**
 * Returns YYYY-MM-DD in Africa/Cairo timezone.
 */
export function getCairoDateString(date?: Date | string | number | null): string {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return getCairoDateString();
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: CAIRO_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
    }
    return `${map.year}-${map.month}-${map.day}`;
}

export function getCairoYearMonth(date?: Date | string | number | null): { year: number; month: number } {
    const [y, m] = getCairoDateString(date).split('-').map(Number);
    return { year: y, month: m };
}

/**
 * Returns the best Date to display for a financial transaction.
 * Falls back to createdAt when legacy records stored date-only strings as 00:00:00.000Z on the same day.
 */
export function getTransactionDisplayDate(tx?: {
    date?: string | Date | null;
    createdAt?: string | Date | null;
} | null): Date | null {
    if (!tx) return null;
    const rawDate = tx.date ? new Date(tx.date) : null;
    const createdAt = tx.createdAt ? new Date(tx.createdAt) : null;
    const hasValidDate = rawDate && !isNaN(rawDate.getTime());
    const hasValidCreatedAt = createdAt && !isNaN(createdAt.getTime());

    if (!hasValidDate) {
        return hasValidCreatedAt ? createdAt : null;
    }

    const isMidnightUtc =
        rawDate.getUTCHours() === 0 &&
        rawDate.getUTCMinutes() === 0 &&
        rawDate.getUTCSeconds() === 0 &&
        rawDate.getUTCMilliseconds() === 0;

    if (isMidnightUtc && hasValidCreatedAt) {
        const rawUtcDay = rawDate.toISOString().slice(0, 10);
        if (rawUtcDay === getCairoDateString(createdAt)) {
            return createdAt;
        }
    }

    return rawDate;
}

export function formatArabicDate(
    date: string | number | Date | undefined | null,
    options?: Intl.DateTimeFormatOptions
): string {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const defaultOptions: Intl.DateTimeFormatOptions = {
            timeZone: CAIRO_TIMEZONE,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...options,
        };
        // ar-EG-u-nu-latn ensures Arabic locale words (months, days) with English digits (0-9)
        return new Intl.DateTimeFormat('ar-EG-u-nu-latn', defaultOptions).format(d);
    } catch {
        return '';
    }
}

export function formatArabicTime(
    date: string | number | Date | undefined | null,
    options?: Intl.DateTimeFormatOptions
): string {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const defaultOptions: Intl.DateTimeFormatOptions = {
            timeZone: CAIRO_TIMEZONE,
            hour: '2-digit',
            minute: '2-digit',
            ...options,
        };
        return new Intl.DateTimeFormat('ar-EG-u-nu-latn', defaultOptions).format(d);
    } catch {
        return '';
    }
}
