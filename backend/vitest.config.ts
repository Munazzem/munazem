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
        // singleFork: true → sequential (مش parallel) لتفادي DB conflicts
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: true },
        },
    },
});
