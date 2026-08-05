/**
 * tests/integration/subscriptions.api.test.ts
 *
 * Integration tests for the System Subscriptions module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeSuperAdminToken, makeTeacherToken, bearerHeader, TEST_IDS } from '../helpers/auth.helper.js';
import { seedSuperAdmin, seedTeacher } from '../helpers/db.helper.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Subscriptions API', () => {

    describe('GET /subscriptions/plans', () => {
        it('يجلب قائمة الباقات المتاحة', async () => {
            await seedTeacher();

            const res = await app
                .get('/subscriptions/plans')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data).toBeInstanceOf(Object);
        });
    });

    describe('POST /subscriptions', () => {
        it('SuperAdmin يمكنه إضافة اشتراك لمعلم بنجاح', async () => {
            await seedSuperAdmin();
            await seedTeacher(); // We need a teacher to subscribe

            const res = await app
                .post('/subscriptions')
                .set('Authorization', bearerHeader(makeSuperAdminToken()))
                .send({
                    teacherId: TEST_IDS.teacher.toString(),
                    planTier: 'BASIC',
                    durationMonths: 1,
                    isFreeTrial: false,
                    paymentMethod: 'CASH'
                });

            expect(res.status).toBe(201);
            expect(res.body.data.teacherId).toBe(TEST_IDS.teacher.toString());
            expect(res.body.data.planTier).toBe('BASIC');
            expect(res.body.message).toContain('بنجاح');
        });

        it('يرفض 403 إذا حاول Teacher إضافة اشتراك', async () => {
            await seedTeacher();

            const res = await app
                .post('/subscriptions')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    teacherId: TEST_IDS.teacher.toString(),
                    planTier: 'BASIC',
                    durationMonths: 1
                });

            expect(res.status).toBe(403); // Forbidden
        });
    });

    describe('GET /subscriptions', () => {
        it('SuperAdmin يجلب جميع الاشتراكات على النظام', async () => {
            await seedSuperAdmin();

            const res = await app
                .get('/subscriptions')
                .set('Authorization', bearerHeader(makeSuperAdminToken()));

            expect(res.status).toBe(200);
            expect(res.body.data).toBeInstanceOf(Array);
        });
    });

    describe('GET /subscriptions/:teacherId', () => {
        it('Teacher يجلب اشتراكاته الخاصة', async () => {
            await seedTeacher();
            await seedSuperAdmin();

            // SuperAdmin creates subscription
            await app
                .post('/subscriptions')
                .set('Authorization', bearerHeader(makeSuperAdminToken()))
                .send({
                    teacherId: TEST_IDS.teacher.toString(),
                    planTier: 'PREMIUM',
                    durationMonths: 3
                });

            const res = await app
                .get(`/subscriptions/${TEST_IDS.teacher.toString()}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
            expect(res.body.data[0].planTier).toBe('PREMIUM');
        });
    });

});
