import 'dotenv/config';

// Cost factor for every password hash in the service. Kept in one place so it can be raised
// as hardware improves without hunting down individual bcrypt.hash calls.
export const BCRYPT_ROUNDS = 12;

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

// Without this the process boots, passes its health check, and then throws on every request
// that needs a secret — a deploy that looks green while nobody can sign in. Fail loudly instead.
export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    );
    process.exit(1);
  }
}
