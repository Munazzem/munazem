/**
 * tests/integration/notebooks.api.test.ts
 *
 * Integration tests for the Notebooks module.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../helpers/app.helper.js';
import { makeTeacherToken, makeAssistantToken, bearerHeader } from '../helpers/auth.helper.js';
import { seedTeacher, seedAssistant, seedNotebook } from '../helpers/db.helper.js';
import { GradeLevel } from '../../src/common/enums/enum.service.js';

let app: ReturnType<typeof getTestApp>;
beforeEach(() => { app = getTestApp(); });

describe('Notebooks API', () => {

    describe('POST /notebooks', () => {
        it('Teacher يمكنه إضافة مذكرة جديدة بنجاح', async () => {
            await seedTeacher();

            const res = await app
                .post('/notebooks')
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    name: 'مذكرة جديدة',
                    gradeLevel: GradeLevel.PREP_1,
                    price: 100,
                    stock: 50
                });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('مذكرة جديدة');
            expect(res.body.data.price).toBe(100);
            expect(res.body.data.stock).toBe(50);
        });

        it('Assistant يمكنه إضافة مذكرة أيضاً', async () => {
            await seedTeacher();
            await seedAssistant();

            const res = await app
                .post('/notebooks')
                .set('Authorization', bearerHeader(makeAssistantToken()))
                .send({
                    name: 'مذكرة المساعد',
                    gradeLevel: GradeLevel.PREP_1,
                    price: 80,
                    stock: 20
                });

            expect(res.status).toBe(201);
            expect(res.body.data.name).toBe('مذكرة المساعد');
        });
    });

    describe('GET /notebooks', () => {
        it('Teacher يجلب قائمة المذكرات الخاصة به', async () => {
            await seedTeacher();
            await seedNotebook({ name: 'مذكرة 1' });
            await seedNotebook({ name: 'مذكرة 2' });

            const res = await app
                .get('/notebooks')
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.data.length).toBe(2);
        });
    });

    describe('GET /notebooks/:id', () => {
        it('يجلب بيانات مذكرة محددة بنجاح', async () => {
            await seedTeacher();
            const nb = await seedNotebook();

            const res = await app
                .get(`/notebooks/${nb._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('مذكرة تجريبية');
        });
    });

    describe('PUT /notebooks/:id', () => {
        it('يُحدّث بيانات المذكرة بنجاح', async () => {
            await seedTeacher();
            const nb = await seedNotebook();

            const res = await app
                .put(`/notebooks/${nb._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({
                    name: 'الاسم المعدل',
                    price: 120
                });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('الاسم المعدل');
            expect(res.body.data.price).toBe(120);
        });
    });

    describe('PATCH /notebooks/:id/restock', () => {
        it('يضيف كمية للمخزون (Restock) بنجاح', async () => {
            await seedTeacher();
            const nb = await seedNotebook({ stock: 10 }); // current stock = 10

            const res = await app
                .patch(`/notebooks/${nb._id}/restock`)
                .set('Authorization', bearerHeader(makeTeacherToken()))
                .send({ quantity: 5 });

            expect(res.status).toBe(200);
            expect(res.body.data.stock).toBe(15);
        });
    });

    describe('DELETE /notebooks/:id', () => {
        it('يحذف المذكرة بنجاح ويرجع 200', async () => {
            await seedTeacher();
            const nb = await seedNotebook();

            const res = await app
                .delete(`/notebooks/${nb._id}`)
                .set('Authorization', bearerHeader(makeTeacherToken()));

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('بنجاح');
        });
    });

});
