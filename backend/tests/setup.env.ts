/**
 * tests/setup.env.ts — Per-File Setup
 *
 * يشتغل في كل test file (في نفس الـ process).
 * مسؤول عن:
 * 1. الاتصال بـ MongoMemoryServer قبل الـ tests
 * 2. مسح كل الـ collections بعد كل test (عشان isolation)
 * 3. إغلاق الاتصال بعد انتهاء الـ test file
 *
 * ملاحظة مهمة: هذا الملف يشتغل في process مختلف عن setup.ts،
 * لذلك الـ MONGO_TEST_URI بيجي عن طريق process.env (مش عن طريق shared memory).
 */

import mongoose from 'mongoose';
import { beforeAll, afterEach, afterAll } from 'vitest';

beforeAll(async () => {
    const uri = process.env['MONGO_TEST_URI'];
    if (!uri) {
        throw new Error(
            '❌ MONGO_TEST_URI is not set. Did globalSetup (tests/setup.ts) run correctly?'
        );
    }

    // اتصل بـ MongoDB الوهمية لو مش متصل أصلاً
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri);
    }
}, 30_000);

afterEach(async () => {
    // امسح كل الـ collections بعد كل test لضمان الـ isolation
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key]!.deleteMany({});
    }
});

afterAll(async () => {
    // أغلق الاتصال بعد انتهاء الـ test file كله
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});
