import { describe, it, expect } from 'vitest';
import {
    getEgyptParts,
    getEgyptYearMonth,
    startOfDayEgypt,
    startOfDayEgyptMs,
    todayEgypt,
    resolveTransactionDate
} from '../../src/common/utils/date.util.js';

describe('Africa/Cairo Timezone & DST Unit Tests', () => {

    it('correctly extracts Cairo date parts in summer (UTC+3, August/June)', () => {
        // 2026-08-31 21:05:00 UTC -> Cairo is 2026-09-01 00:05:00 (UTC+3)
        const dateSummerMidnight = new Date('2026-08-31T21:05:00.000Z');
        const parts = getEgyptParts(dateSummerMidnight);

        expect(parts.year).toBe(2026);
        expect(parts.month).toBe(9);
        expect(parts.day).toBe(1);
        expect(parts.hour).toBe(0);
        expect(parts.minute).toBe(5);

        const yearMonth = getEgyptYearMonth(dateSummerMidnight);
        expect(yearMonth).toEqual({ year: 2026, month: 9 });
    });

    it('correctly handles month boundary: Aug 31 23:59 Egypt vs Sep 1 00:01 Egypt', () => {
        // 2026-08-31 20:59:00 UTC -> Cairo is 2026-08-31 23:59:00 (August)
        const augLastMinute = new Date('2026-08-31T20:59:00.000Z');
        expect(getEgyptYearMonth(augLastMinute)).toEqual({ year: 2026, month: 8 });
        expect(todayEgypt(augLastMinute)).toBe('2026-08-31');

        // 2026-08-31 21:01:00 UTC -> Cairo is 2026-09-01 00:01:00 (September)
        const sepFirstMinute = new Date('2026-08-31T21:01:00.000Z');
        expect(getEgyptYearMonth(sepFirstMinute)).toEqual({ year: 2026, month: 9 });
        expect(todayEgypt(sepFirstMinute)).toBe('2026-09-01');
    });

    it('correctly extracts Cairo date parts in winter (UTC+2, January/November)', () => {
        // 2026-01-15 22:05:00 UTC -> In Cairo winter (UTC+2), this is 2026-01-16 00:05:00
        const dateWinterMidnight = new Date('2026-01-15T22:05:00.000Z');
        const parts = getEgyptParts(dateWinterMidnight);

        expect(parts.year).toBe(2026);
        expect(parts.month).toBe(1);
        expect(parts.day).toBe(16);
        expect(parts.hour).toBe(0);
        expect(parts.minute).toBe(5);

        const yearMonth = getEgyptYearMonth(dateWinterMidnight);
        expect(yearMonth).toEqual({ year: 2026, month: 1 });
    });

    it('startOfDayEgypt returns UTC Date object at 00:00:00 for the Cairo calendar day', () => {
        // Summer date: 2026-08-15 14:30:00 UTC (17:30 Cairo)
        const summerDate = new Date('2026-08-15T14:30:00.000Z');
        const summerMidnight = startOfDayEgypt(summerDate);
        expect(summerMidnight.toISOString()).toBe('2026-08-15T00:00:00.000Z');

        // Winter date: 2026-01-15 14:30:00 UTC (16:30 Cairo)
        const winterDate = new Date('2026-01-15T14:30:00.000Z');
        const winterMidnight = startOfDayEgypt(winterDate);
        expect(winterMidnight.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    });

    it('startOfDayEgyptMs returns numeric timestamp for Cairo midnight', () => {
        const summerDate = new Date('2026-08-15T14:30:00.000Z');
        const summerMs = startOfDayEgyptMs(summerDate);
        expect(summerMs).toBe(new Date('2026-08-14T21:00:00.000Z').getTime());
    });
});
