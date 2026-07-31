import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // ── Environment ──────────────────────────────────────────────────
        globals: true,          // describe, it, expect بدون imports
        environment: 'node',    // Node.js environment (مش jsdom)

        // ── File patterns ─────────────────────────────────────────────────
        include: ['tests/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],

        // ── Setup / Teardown ──────────────────────────────────────────────
        // globalSetup: يشتغل مرة واحدة قبل كل الـ test files (في process منفصل)
        globalSetup: ['./tests/setup.ts'],
        // setupFiles: يشتغل في كل test file قبل الـ tests (في نفس الـ process)
        setupFiles: ['./tests/setup.env.ts'],

        // ── Timeouts ──────────────────────────────────────────────────────
        testTimeout: 15_000,    // DB operations ممكن تاخد وقت
        hookTimeout: 30_000,    // MongoMemoryServer startup ممكن يكون بطيء

        // ── Isolation ─────────────────────────────────────────────────────
        // pool: 'forks' → كل test file في process منفصل
        // fileParallelism: false → sequential (مش parallel) لتفادي DB conflicts في نفس الـ MongoMemoryServer
        pool: 'forks',
        fileParallelism: false,

        // ── Coverage ──────────────────────────────────────────────────────
        // شغّل: npm run test:coverage
        // الـ threshold معلّق — هيتفعّل في نهاية Phase 4 لما التغطية تتعدى 80%
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: './coverage',

            // كل الـ source files اللي محتاجين نقيس تغطيتها
            include: ['src/**/*.ts'],

            // مستبعد: الـ infra الخارجية + scripts + entry point
            exclude: [
                'src/main.ts',
                'src/infrastructure/**',
                'src/scripts/**',
                'src/types/**',
                'src/**/*.d.ts',
            ],

            // ─────────────────────────────────────────────────────────────
            // ⚠️  PHASE 4 NOTE: uncomment the block below once real coverage
            //     consistently exceeds 80% (after Phase 4 tests are merged).
            // ─────────────────────────────────────────────────────────────
            // thresholds: {
            //     lines:      80,
            //     statements: 80,
            //     functions:  75,
            //     branches:   70,
            // },
        },
    },
});
