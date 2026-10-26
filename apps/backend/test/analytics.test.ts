import { beforeAll, describe, expect, it } from 'vitest';
import { as, prisma, seed, tokenFor, type Fixtures } from './helpers';

// Analytics are computed from AuditLog. These tests write rows at known times rather than going
// through real sign-ins, so the expected numbers are exact.

let f: Fixtures;
let superTok: string;
let adminATok: string;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, hour = 12) => {
  const d = new Date(Date.now() - n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
};

beforeAll(async () => {
  f = await seed();
  // Tokens first: those sign-ins are themselves audited, so clear them before writing fixtures.
  superTok = await tokenFor('super@test.dev');
  adminATok = await tokenFor('admin-a@test.dev');
  await new Promise((r) => setTimeout(r, 150));
  await prisma.auditLog.deleteMany();

  const row = (action: string, platformId: string, at: Date, extra: object = {}) => ({ action, platformId, createdAt: at, ...extra });
  await prisma.auditLog.createMany({
    data: [
      // Alpha, this week: 3 sign-ins by 2 people, 1 failure from 10.0.0.1.
      row('LOGIN_SUCCEEDED', f.alpha.id, daysAgo(1), { actorId: f.adminA.id }),
      row('LOGIN_SUCCEEDED', f.alpha.id, daysAgo(2), { actorId: f.adminA.id }),
      row('LOGIN_SUCCEEDED', f.alpha.id, daysAgo(2), { actorId: f.adminAB.id }),
      row('LOGIN_FAILED', f.alpha.id, daysAgo(1), { ipAddress: '10.0.0.1', metadata: { email: 'x@test.dev' } }),
      row('INVITE_CREATED', f.alpha.id, daysAgo(3)),
      // Alpha, the week before: 1 sign-in.
      row('LOGIN_SUCCEEDED', f.alpha.id, daysAgo(10), { actorId: f.adminA.id }),
      // Beta, this week: 2 sign-ins, 2 failures from 10.0.0.2.
      row('LOGIN_SUCCEEDED', f.beta.id, daysAgo(1), { actorId: f.userB.id }),
      row('LOGIN_SUCCEEDED', f.beta.id, daysAgo(3), { actorId: f.userB.id }),
      row('LOGIN_FAILED', f.beta.id, daysAgo(1), { ipAddress: '10.0.0.2', metadata: { email: 'y@test.dev' } }),
      row('LOGIN_FAILED', f.beta.id, daysAgo(2), { ipAddress: '10.0.0.2', metadata: { email: 'y@test.dev' } }),
    ],
  });
});

describe('GET /api/admin/analytics/summary', () => {
  it('counts one platform for its admin, with change from the previous period', async () => {
    const res = await as(adminATok).get(`/api/admin/analytics/summary?platformId=${f.alpha.id}&range=7d`);
    expect(res.status).toBe(200);
    expect(res.body.logins).toEqual({ value: 3, previous: 1, change: 200 });
    expect(res.body.failedLogins.value).toBe(1);
    expect(res.body.failedRate.value).toBe(25);
    expect(res.body.activeUsers.value).toBe(2);
    expect(res.body.members.value).toBe(3);
  });

  it('counts every platform for a super-admin', async () => {
    const res = await as(superTok).get('/api/admin/analytics/summary?range=7d');
    expect(res.body.logins.value).toBe(5);
    expect(res.body.failedLogins.value).toBe(3);
    expect(res.body.activeUsers.value).toBe(3);
    expect(res.body.members.value).toBe(5);
  });

  it('reports a change of null when there is nothing to compare against', async () => {
    const res = await as(superTok).get(`/api/admin/analytics/summary?platformId=${f.beta.id}&range=7d`);
    expect(res.body.logins.change).toBeNull();
  });
});

describe('GET /api/admin/analytics/timeseries', () => {
  it('returns one zero-filled point per day', async () => {
    const res = await as(adminATok).get(`/api/admin/analytics/timeseries?platformId=${f.alpha.id}&range=7d`);
    expect(res.body.bucket).toBe('day');
    expect(res.body.points).toHaveLength(8); // seven full days back plus today
    const total = (k: string) => res.body.points.reduce((s: number, p: Record<string, number>) => s + p[k], 0);
    expect(total('logins')).toBe(3);
    expect(total('failed')).toBe(1);
    expect(total('invites')).toBe(1);
    expect(res.body.points.filter((p: { logins: number }) => p.logins === 0).length).toBeGreaterThan(0);
  });

  it('uses hourly buckets for 24 hours', async () => {
    const res = await as(superTok).get('/api/admin/analytics/timeseries?range=24h');
    expect(res.body.bucket).toBe('hour');
    expect(res.body.points.length).toBeGreaterThanOrEqual(24);
  });
});

describe('GET /api/admin/analytics/top', () => {
  it('ranks where failed sign-ins come from', async () => {
    const ips = await as(superTok).get('/api/admin/analytics/top?kind=failed_ips&range=7d');
    expect(ips.body.items[0]).toMatchObject({ key: '10.0.0.2', count: 2 });

    const emails = await as(adminATok).get(`/api/admin/analytics/top?kind=failed_emails&platformId=${f.alpha.id}&range=7d`);
    expect(emails.body.items).toEqual([expect.objectContaining({ key: 'x@test.dev', count: 1 })]);
  });
});

describe('GET /api/admin/analytics/platforms', () => {
  it('breaks the numbers down per platform', async () => {
    const res = await as(superTok).get('/api/admin/analytics/platforms?range=7d');
    const byName = Object.fromEntries(res.body.map((r: { name: string }) => [r.name, r]));
    expect(byName.Alpha).toMatchObject({ members: 3, logins: 3, failed: 1 });
    expect(byName.Beta).toMatchObject({ members: 2, logins: 2, failed: 2 });
  });
});
