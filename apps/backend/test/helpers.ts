import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/db/prisma';
import { signAccessToken, signRefreshToken } from '../src/services/signing-key.service';

export { app, prisma };

export const PASSWORD = 'password123';

// Every app table, listed explicitly so a reset never touches _prisma_migrations. CASCADE takes
// care of foreign-key order. SigningKey is left alone: the signing service caches the active key
// in memory, and deleting its row mid-file would leave tokens signed by a key nobody can find.
const TABLES = [
  'AuditLog',
  'Session',
  'PasswordResetToken',
  'EmailVerificationToken',
  'Invitation',
  'PlatformInviteKey',
  'UserPlatformAccess',
  'Platform',
  'User',
];

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

/**
 * The standard cast, used across the suite:
 * - platforms Alpha and Beta (Beta allows self-registration)
 * - super:   super-admin, no memberships
 * - adminA:  ADMIN of Alpha
 * - adminAB: ADMIN of Alpha and Beta
 * - userB:   USER of Beta
 * - unverified: USER of Alpha, email not confirmed
 */
export async function seed() {
  await resetDb();
  const hash = await bcrypt.hash(PASSWORD, 4);

  const alpha = await prisma.platform.create({ data: { name: 'Alpha', description: 'Alpha platform' } });
  const beta = await prisma.platform.create({ data: { name: 'Beta', allowSelfRegistration: true } });

  const user = (email: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email, password: hash, emailVerified: true, ...extra } });

  const superAdmin = await user('super@test.dev', { isSuperAdmin: true });
  const adminA = await user('admin-a@test.dev');
  const adminAB = await user('admin-ab@test.dev');
  const userB = await user('user-b@test.dev');
  const unverified = await user('unverified@test.dev', { emailVerified: false });

  await prisma.userPlatformAccess.createMany({
    data: [
      { userId: adminA.id, platformId: alpha.id, role: 'ADMIN' },
      { userId: adminAB.id, platformId: alpha.id, role: 'ADMIN' },
      { userId: adminAB.id, platformId: beta.id, role: 'ADMIN' },
      { userId: userB.id, platformId: beta.id, role: 'USER' },
      { userId: unverified.id, platformId: alpha.id, role: 'USER' },
    ],
  });

  return { alpha, beta, superAdmin, adminA, adminAB, userB, unverified };
}

export type Fixtures = Awaited<ReturnType<typeof seed>>;

export interface LoginResult {
  status: number;
  body: Record<string, unknown>;
  token: string;
  // The refreshToken cookie, ready to send back as a Cookie header.
  refreshCookie?: string;
}

export async function login(email: string, platformId?: string, password = PASSWORD): Promise<LoginResult> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password, ...(platformId ? { platformId } : {}) });
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return {
    status: res.status,
    body: res.body,
    token: res.body.accessToken,
    refreshCookie: cookies.find((c) => c.startsWith('refreshToken='))?.split(';')[0],
  };
}

/**
 * A signed-in session for a fixture user, minted the way login() does but without going through
 * /api/auth/login, so fixture setup never spends the login rate limit that tests of sign-in
 * itself depend on. Tests about sign-in behaviour call login() instead.
 */
export async function sessionFor(email: string): Promise<{ token: string; refreshCookie: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const claims = { id: user.id, email: user.email, sessionId: randomUUID() };
  const [token, refresh] = await Promise.all([signAccessToken(claims), signRefreshToken(claims)]);
  await prisma.session.create({
    data: { id: claims.sessionId, userId: user.id, hashedToken: await bcrypt.hash(refresh, 4), ipAddress: '127.0.0.1' },
  });
  return { token, refreshCookie: `refreshToken=${refresh}` };
}

export async function tokenFor(email: string): Promise<string> {
  return (await sessionFor(email)).token;
}

// Authenticated request helpers: as(token).get('/api/...').
export function as(token: string) {
  const auth = (t: request.Test) => t.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(app).get(url)),
    post: (url: string, body?: object) => auth(request(app).post(url)).send(body ?? {}),
    patch: (url: string, body?: object) => auth(request(app).patch(url)).send(body ?? {}),
    delete: (url: string, body?: object) => auth(request(app).delete(url)).send(body ?? {}),
  };
}

// logActivity is fire-and-forget; give it a moment to land before reading the audit log.
export const settle = () => new Promise((r) => setTimeout(r, 150));
