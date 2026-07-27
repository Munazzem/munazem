/**
 * tests/helpers/app.helper.ts
 *
 * ينشئ Express app instance جاهزة للاستخدام مع supertest.
 *
 * يستخدم createApp() من src/app.controller.ts — وهي pure factory
 * (بدون DB connection، بدون background workers، بدون listen).
 *
 * الـ DB connection يُدار بواسطة tests/setup.env.ts (beforeAll/afterAll).
 *
 * الاستخدام في integration tests:
 * ```ts
 * import { getTestApp } from '../helpers/app.helper.js';
 *
 * const app = getTestApp();
 *
 * it('GET /health returns 200', async () => {
 *     const res = await app.get('/health');
 *     expect(res.status).toBe(200);
 * });
 *
 * it('POST /students requires auth', async () => {
 *     const res = await app
 *         .post('/students')
 *         .set('Authorization', bearerHeader(makeTeacherToken()))
 *         .send({ ... });
 *     expect(res.status).toBe(201);
 * });
 * ```
 */

import supertest from 'supertest';
import { createApp } from '../../src/app.controller.js';

// Singleton: ننشئ الـ app مرة واحدة لكل test file
let appInstance: ReturnType<typeof supertest> | null = null;

export function getTestApp(): ReturnType<typeof supertest> {
    if (!appInstance) {
        appInstance = supertest(createApp());
    }
    return appInstance;
}

/**
 * يُعيد تهيئة الـ app — مفيد لو احتجت fresh instance
 */
export function resetTestApp(): void {
    appInstance = null;
}
