import { testDatabaseUrl } from './test-db';

// Runs before each test file imports the app. Values set here win over apps/backend/.env,
// because dotenv never overrides a variable that is already set.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret';
process.env.EMAIL_PROVIDER = 'console';
process.env.ALLOWED_ORIGINS = 'http://localhost:3001';
// The redirect rules read these on every call, so individual tests may change them.
delete process.env.ALLOW_LOCALHOST_REDIRECT;
delete process.env.LEGACY_REDIRECT_FALLBACK;
