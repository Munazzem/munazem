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

export function formatArabicDate(
    date: string | number | Date | undefined | null,
    options?: Intl.DateTimeFormatOptions
): string {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const defaultOptions: Intl.DateTimeFormatOptions = {
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
            hour: '2-digit',
            minute: '2-digit',
            ...options,
        };
        return new Intl.DateTimeFormat('ar-EG-u-nu-latn', defaultOptions).format(d);
    } catch {
        return '';
    }
}
