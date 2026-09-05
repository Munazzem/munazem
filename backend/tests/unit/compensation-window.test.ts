import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/attendance.service.js';
import { GroupModel } from '../../src/database/models/group.model.js';

describe('AttendanceService.getCompensationWindow', () => {

    it('يحسب نافذة الفترة الأولى (السبت والأحد والإثنين) للمجموعات التي تلتقي مرتين أسبوعياً', async () => {
        // Mock group with 2 sessions per week (السبت والأربعاء)
        vi.spyOn(GroupModel, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                schedule: [
                    { day: 'السبت', time: '12:00' },
                    { day: 'الأربعاء', time: '16:00' }
                ]
            })
        } as any);

        const satDate = new Date('2026-09-05T00:00:00.000Z'); // السبت
        const { windowStart, windowEnd } = await AttendanceService.getCompensationWindow('fake-group-id', satDate);

        // يجب أن تبدأ النافذة من بداية السبت 5 سبتمبر وتنتهي بنهاية الإثنين 7 سبتمبر بتوقيت مصر
        const wedGuestDate = new Date('2026-09-02T10:20:00.000Z'); // الأربعاء في الأسبوع السابق
        const sunGuestDate = new Date('2026-09-06T10:00:00.000Z'); // الأحد في نفس الفترة
        const monGuestDate = new Date('2026-09-07T12:00:00.000Z'); // الإثنين في نفس الفترة
        const tueGuestDate = new Date('2026-09-08T10:00:00.000Z'); // الثلاثاء (فترة جديدة بشرح جديد)

        // الأربعاء السابق خارج النافذة
        expect(wedGuestDate >= windowStart && wedGuestDate <= windowEnd).toBe(false);

        // الأحد والإثنين داخل النافذة (يجوز التعويض)
        expect(sunGuestDate >= windowStart && sunGuestDate <= windowEnd).toBe(true);
        expect(monGuestDate >= windowStart && monGuestDate <= windowEnd).toBe(true);

        // الثلاثاء خارج النافذة (حصة جديدة)
        expect(tueGuestDate >= windowStart && tueGuestDate <= windowEnd).toBe(false);
    });

    it('يحسب نافذة الفترة الثانية (الثلاثاء والأربعاء والخميس والجمعة) لنفس الأسبوع', async () => {
        vi.spyOn(GroupModel, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                schedule: [
                    { day: 'السبت', time: '12:00' },
                    { day: 'الأربعاء', time: '16:00' }
                ]
            })
        } as any);

        const wedDate = new Date('2026-09-09T00:00:00.000Z'); // الأربعاء
        const { windowStart, windowEnd } = await AttendanceService.getCompensationWindow('fake-group-id', wedDate);

        const prevSatDate = new Date('2026-09-05T10:00:00.000Z'); // السبت (فترة ماضية)
        const tueDate     = new Date('2026-09-08T10:00:00.000Z'); // الثلاثاء (نفس الفترة)
        const thuDate     = new Date('2026-09-10T10:00:00.000Z'); // الخميس (نفس الفترة)
        const nextSatDate = new Date('2026-09-12T10:00:00.000Z'); // السبت القادم (أسبوع جديد)

        // السبت من الفترة الأولى لا يمكن التعويض فيه
        expect(prevSatDate >= windowStart && prevSatDate <= windowEnd).toBe(false);

        // الثلاثاء والخميس داخل النافذة
        expect(tueDate >= windowStart && tueDate <= windowEnd).toBe(true);
        expect(thuDate >= windowStart && thuDate <= windowEnd).toBe(true);

        // السبت في الأسبوع الجديد خارج النافذة
        expect(nextSatDate >= windowStart && nextSatDate <= windowEnd).toBe(false);
    });

    it('يغطي الأسبوع بالكامل (من السبت للجمعة) للمجموعات التي تلتقي مرة واحدة أسبوعياً', async () => {
        vi.spyOn(GroupModel, 'findById').mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                schedule: [
                    { day: 'الخميس', time: '14:00' }
                ]
            })
        } as any);

        const thuDate = new Date('2026-09-10T00:00:00.000Z'); // الخميس
        const { windowStart, windowEnd } = await AttendanceService.getCompensationWindow('fake-group-id', thuDate);

        const satSameWeek = new Date('2026-09-05T10:00:00.000Z');
        const monSameWeek = new Date('2026-09-07T10:00:00.000Z');
        const friSameWeek = new Date('2026-09-11T12:00:00.000Z');
        const nextSat     = new Date('2026-09-12T10:00:00.000Z');

        // كامل أيام الأسبوع داخل النافذة
        expect(satSameWeek >= windowStart && satSameWeek <= windowEnd).toBe(true);
        expect(monSameWeek >= windowStart && monSameWeek <= windowEnd).toBe(true);
        expect(friSameWeek >= windowStart && friSameWeek <= windowEnd).toBe(true);

        // الأسبوع التالي خارج النافذة
        expect(nextSat >= windowStart && nextSat <= windowEnd).toBe(false);
    });
});
