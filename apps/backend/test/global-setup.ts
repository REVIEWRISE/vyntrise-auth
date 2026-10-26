import { execSync } from 'child_process';
import path from 'path';
import { testDatabaseUrl } from './test-db';

// Brings the test database up to the current schema once, before any file runs.
export default function setup() {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: process.env.TEST_VERBOSE ? 'inherit' : 'pipe',
  });
}
