import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Migrates the test database once per run.
    globalSetup: ['test/global-setup.ts'],
    // Points DATABASE_URL at the test database before any app module (and so Prisma) loads.
    setupFiles: ['test/env.ts'],
    // Every file truncates and re-seeds the same database, so files must not overlap. Each file
    // still gets its own module registry, which also resets the in-memory rate limiters and caches.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    // The console email provider and the app's own diagnostics are noise in a test run.
    // TEST_VERBOSE=1 brings them back when debugging.
    onConsoleLog: () => (process.env.TEST_VERBOSE ? undefined : false),
  },
});
