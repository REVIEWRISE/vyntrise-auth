import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, as, login, prisma, seed, settle, tokenFor, type Fixtures } from './helpers';

let f: Fixtures;
let superTok: string;
let adminATok: string;

beforeAll(async () => {
  f = await seed();
  superTok = await tokenFor('super@test.dev');
  adminATok = await tokenFor('admin-a@test.dev');
});

describe('sign-in telemetry', () => {
  it('records successful, failed and denied sign-ins against the platform, with IP and user agent', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'vitest-agent')
      .send({ email: 'admin-a@test.dev', password: 'wrong', platformId: f.alpha.id });
    await login('user-b@test.dev', f.alpha.id); // member of Beta only → denied on Alpha
    await login('admin-a@test.dev', f.alpha.id);
    await settle();

    const rows = await prisma.auditLog.findMany({
      where: { platformId: f.alpha.id, action: { in: ['LOGIN_FAILED', 'LOGIN_DENIED_NO_ACCESS', 'LOGIN_SUCCEEDED'] } },
    });
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('LOGIN_FAILED');
    expect(actions).toContain('LOGIN_DENIED_NO_ACCESS');
    expect(actions).toContain('LOGIN_SUCCEEDED');
    expect(rows.every((r) => r.ipAddress)).toBe(true);
    expect(rows.find((r) => r.action === 'LOGIN_FAILED')!.userAgent).toBe('vitest-agent');
  });

  it('drops an unknown platformId rather than losing the audit row', async () => {
    await login('admin-ab@test.dev', 'not-a-real-platform', 'wrong');
    await settle();
    const row = await prisma.auditLog.findFirst({
      where: { action: 'LOGIN_FAILED', metadata: { path: ['email'], equals: 'admin-ab@test.dev' } },
    });
    expect(row).not.toBeNull();
    expect(row!.platformId).toBeNull();
  });

  it('stores the client IP on the session', async () => {
    await login('admin-ab@test.dev');
    const session = await prisma.session.findFirstOrThrow({ where: { userId: f.adminAB.id } });
    expect(session.ipAddress).toBeTruthy();
  });
});

describe('GET /api/admin/audit', () => {
  it('pages with a cursor, without duplicates or gaps, even when timestamps collide', async () => {
    // Twelve rows sharing one timestamp: offset paging would skip or repeat some of these.
    const at = new Date('2026-01-01T00:00:00Z');
    await prisma.auditLog.createMany({
      data: Array.from({ length: 12 }, (_, i) => ({
        platformId: f.alpha.id,
        action: 'INVITE_CREATED',
        targetType: 'invitation',
        targetId: `same-ts-${i}`,
        createdAt: at,
      })),
    });

    const all = await as(superTok).get(`/api/admin/audit?platformId=${f.alpha.id}&limit=100`);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: request.Response = await as(superTok).get(
        `/api/admin/audit?platformId=${f.alpha.id}&limit=5${cursor ? `&cursor=${cursor}` : ''}`
      );
      seen.push(...res.body.items.map((i: { id: string }) => i.id));
      cursor = res.body.nextCursor;
    } while (cursor);

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(all.body.items.map((i: { id: string }) => i.id));
  });

  it('filters by action, target, IP and free text', async () => {
    const byAction = await as(superTok).get('/api/admin/audit?action=LOGIN_DENIED_NO_ACCESS');
    expect(byAction.body.items.length).toBeGreaterThan(0);
    expect(byAction.body.items.every((i: { action: string }) => i.action === 'LOGIN_DENIED_NO_ACCESS')).toBe(true);

    const multi = await as(superTok).get('/api/admin/audit?action=LOGIN_FAILED,LOGIN_SUCCEEDED&limit=100');
    expect(new Set(multi.body.items.map((i: { action: string }) => i.action))).toEqual(new Set(['LOGIN_FAILED', 'LOGIN_SUCCEEDED']));

    const byTarget = await as(superTok).get('/api/admin/audit?targetId=same-ts-3');
    expect(byTarget.body.items).toHaveLength(1);

    const text = await as(superTok).get('/api/admin/audit?q=user-b@test.dev');
    expect(text.body.items.length).toBeGreaterThan(0);

    const ip = text.body.items.find((i: { ipAddress: string | null }) => i.ipAddress)?.ipAddress;
    const byIp = await as(superTok).get(`/api/admin/audit?ip=${encodeURIComponent(ip)}&limit=100`);
    expect(byIp.body.items.every((i: { ipAddress: string }) => i.ipAddress === ip)).toBe(true);
  });

  it('finds events a user did or had done to them', async () => {
    const res = await as(superTok).get(`/api/admin/audit?userId=${f.userB.id}&limit=100`);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(
      res.body.items.every(
        (i: { actorId: string; targetType: string; targetId: string }) =>
          i.actorId === f.userB.id || (i.targetType === 'user' && i.targetId === f.userB.id)
      )
    ).toBe(true);
  });

  it('honours a date range', async () => {
    const res = await as(superTok).get('/api/admin/audit?from=2025-12-31T00:00:00Z&to=2026-01-02T00:00:00Z&limit=100');
    expect(res.body.items).toHaveLength(12);
  });

  it('shows a platform admin only their platform, never platform-less rows', async () => {
    const res = await as(adminATok).get('/api/admin/audit?limit=100');
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i: { platformId: string }) => i.platformId === f.alpha.id)).toBe(true);

    const orphan = await prisma.auditLog.findFirstOrThrow({ where: { platformId: null } });
    expect((await as(adminATok).get(`/api/admin/audit/${orphan.id}`)).status).toBe(404);
    expect((await as(superTok).get(`/api/admin/audit/${orphan.id}`)).status).toBe(200);
  });

  it('lists the known actions for the filter menu', async () => {
    const res = await as(adminATok).get('/api/admin/audit/meta');
    expect(res.body.actions).toContain('LOGIN_SUCCEEDED');
    expect(res.body.targetTypes).toContain('user');
  });
});

describe('GET /api/admin/audit/export.csv', () => {
  const fetchCsv = async (query = '') => {
    const res = await as(superTok).get(`/api/admin/audit/export.csv${query}`).buffer(true).parse((r, cb) => {
      let data = '';
      r.on('data', (c: Buffer) => (data += c));
      r.on('end', () => cb(null, data));
    });
    return { status: res.status, type: res.headers['content-type'], text: res.body as string };
  };

  it('exports the filtered rows with a header', async () => {
    const list = await as(superTok).get(`/api/admin/audit?platformId=${f.alpha.id}&limit=100`);
    const csv = await fetchCsv(`?platformId=${f.alpha.id}`);
    expect(csv.status).toBe(200);
    expect(csv.type).toMatch(/text\/csv/);
    const lines = csv.text.trim().split('\n');
    expect(lines[0]).toBe('createdAt,action,platformName,actorEmail,targetType,targetId,ipAddress,userAgent,metadata');
    expect(lines.length - 1).toBe(list.body.items.length);
  });

  it('defuses spreadsheet formulas in attacker-controlled values', async () => {
    await prisma.auditLog.create({
      data: { action: 'LOGIN_FAILED', targetType: 'user', targetId: '=HYPERLINK("http://evil")', ipAddress: '+1-2' },
    });
    const csv = await fetchCsv('?action=LOGIN_FAILED');
    const line = csv.text.split('\n').find((l) => l.includes('HYPERLINK'))!;
    expect(line).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(line).toContain(`'+1-2`);
    // No cell may start with a formula character.
    expect(csv.text.split('\n').some((l) => /(^|,)"?[=+\-@]/.test(l))).toBe(false);
  });
});
