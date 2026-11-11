import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader, TEST_IDS } from '../helpers/auth.helper.js';
import { seedTeacher, seedStudent, seedGroup, seedAssistant } from '../helpers/db.helper.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('GET /reports/offline-bundle', () => {
    it('Teacher يمكنه جلب حزمة تقارير الأوفلاين الشاملة لجميع طلابه بنجاح', async () => {
        await seedTeacher();
        const group = await seedGroup();
        const student = await seedStudent(group._id);

        const res = await app
            .get('/reports/offline-bundle')
            .set('Authorization', bearerHeader(makeTeacherToken()));

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('تم تجهيز حزمة تقارير الطلاب للأوفلاين بنجاح');
        expect(Array.isArray(res.body.data.reports)).toBe(true);
        expect(res.body.data.reports.length).toBeGreaterThan(0);

        const found = res.body.data.reports.find((r: any) => r.studentId === student._id.toString());
        expect(found).toBeDefined();
        expect(found.report.student.studentName).toBe(student.studentName);
        expect(found.report.attendance).toBeDefined();
        expect(found.report.payments).toBeDefined();
        expect(found.report.grades).toBeDefined();
    });

    it('Assistant يمكنه جلب حزمة تقارير الأوفلاين لمعلمه بنجاح', async () => {
        await seedTeacher();
        await seedAssistant();
        const group = await seedGroup();
        await seedStudent(group._id);

        const res = await app
            .get('/reports/offline-bundle')
            .set('Authorization', bearerHeader(makeAssistantToken()));

        expect(res.status).toBe(200);
        expect(res.body.data.reports).toBeDefined();
        expect(Array.isArray(res.body.data.reports)).toBe(true);
    });

    it('يرفض الطلب بدون توكن بـ 401', async () => {
        const res = await app.get('/reports/offline-bundle');
        expect(res.status).toBe(401);
    });
});
