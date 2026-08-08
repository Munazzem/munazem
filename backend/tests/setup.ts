/**
 * tests/setup.ts — Global Setup
 *
 * يشتغل مرة واحدة قبل كل الـ test files في process منفصل.
 * مسؤول عن:
 * 1. تشغيل MongoMemoryServer (الـ MongoDB الوهمية)
 * 2. تمرير الـ URI لبقية الـ tests عن طريق process.env
 * 3. إعداد الـ environment variables المطلوبة
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

export async function setup() {
    // 1. شغّل MongoDB في الـ memory
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // 2. شارك الـ URI مع كل test files عن طريق environment variable
    process.env['MONGO_TEST_URI'] = uri;

    // 3. disable الـ transactions لأن standalone MongoDB مش بتدعمهم
    //    الـ flag ده موجود أصلاً في transaction.util.ts لهذا الغرض
    process.env['DISABLE_TRANSACTIONS'] = 'true';

    // 4. JWT secrets — بتتقرأ على مستوى module في token.util.ts
    process.env['JWT_SECRET'] = 'test-jwt-secret-32-chars-minimum!!';
    process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-32-chars-min!';

    // 5. باقي الـ env vars اللي بتتقرأها env.service.ts
    process.env['MONGO_URL'] = uri;
    process.env['PORT'] = '0';
    process.env['MOOD'] = 'test';
    process.env['SALT'] = '10';
    process.env['FRONTEND_URL'] = 'http://localhost:3000';
    process.env['REDIS_URL'] = 'redis://localhost:9999'; // port وهمي — الـ cache هيعمل graceful degradation

    console.log('\n🧪 [setup] MongoMemoryServer started:', uri, '\n');
}

export async function teardown() {
    if (mongod) {
        // ⚠️  اطبع الـ log قبل إيقاف الـ server وليس بعده.
        // الـ console.log في globalSetup/teardown يُرسَل كـ RPC call إلى
        // Vitest main process عبر onUserConsoleLog. لو طبعناه بعد stop()،
        // الـ RPC channel يكون بدأ يتغلق فيحصل race condition:
        //   "Closing rpc while onUserConsoleLog was pending"
        process.stdout.write('\n🧪 [teardown] MongoMemoryServer stopped\n\n');
        await mongod.stop();
    }
}
