import { beforeAll, describe, expect, it } from 'vitest';
import { as, seed, tokenFor, type Fixtures } from './helpers';

// Who may call what. The backend is the only real enforcement; the console just hides buttons.

let f: Fixtures;
let tok: { super: string; adminA: string; adminAB: string; userB: string };

beforeAll(async () => {
  f = await seed();
  tok = {
    super: await tokenFor('super@test.dev'),
    adminA: await tokenFor('admin-a@test.dev'),
    adminAB: await tokenFor('admin-ab@test.dev'),
    userB: await tokenFor('user-b@test.dev'),
  };
});

describe('GET /api/admin/me', () => {
  it('identifies a super-admin and lists every platform', async () => {
    const res = await as(tok.super).get('/api/admin/me');
    expect(res.status).toBe(200);
    expect(res.body.isSuperAdmin).toBe(true);
    expect(res.body.platforms.map((p: { name: string }) => p.name).sort()).toEqual(['Alpha', 'Beta']);
    // A super-admin with no membership still administers the platform, flagged as such.
    expect(res.body.platforms.every((p: { role: string }) => p.role === 'SUPER_ADMIN')).toBe(true);
  });

  it('lists only the platforms a platform admin administers', async () => {
    const res = await as(tok.adminA).get('/api/admin/me');
    expect(res.status).toBe(200);
    expect(res.body.isSuperAdmin).toBe(false);
    expect(res.body.platforms).toEqual([{ id: f.alpha.id, name: 'Alpha', role: 'ADMIN' }]);
  });

  it('refuses a user who administers nothing', async () => {
    expect((await as(tok.userB).get('/api/admin/me')).status).toBe(403);
  });

  it('requires authentication', async () => {
    expect((await as('not-a-token').get('/api/admin/me')).status).toBe(401);
  });
});

describe('platform scoping', () => {
  it('keeps a platform admin out of another platform', async () => {
    const B = f.beta.id;
    for (const url of [
      `/api/admin/users?platformId=${B}`,
      `/api/admin/invites?platformId=${B}`,
      `/api/admin/audit?platformId=${B}`,
      `/api/admin/audit/meta?platformId=${B}`,
      `/api/admin/analytics/summary?platformId=${B}`,
      `/api/admin/analytics/timeseries?platformId=${B}`,
      `/api/admin/platforms/${B}`,
      `/api/admin/platforms/${B}/invite-keys`,
    ]) {
      const res = await as(tok.adminA).get(url);
      expect(res.status, url).toBe(403);
    }
    expect((await as(tok.adminA).patch(`/api/admin/platforms/${B}`, { allowSelfRegistration: false })).status).toBe(403);
    expect((await as(tok.adminA).post(`/api/admin/platforms/${B}/invite-key`)).status).toBe(403);
  });

  it('lets a super-admin into any platform without a membership', async () => {
    const res = await as(tok.super).get(`/api/admin/users?platformId=${f.beta.id}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect((await as(tok.super).get(`/api/admin/platforms/${f.beta.id}`)).body.name).toBe('Beta');
  });

  it('answers 404, not 403, for a super-admin naming a platform that does not exist', async () => {
    expect((await as(tok.super).get('/api/admin/platforms/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('hides users outside the caller’s platforms behind a 404', async () => {
    expect((await as(tok.adminA).get(`/api/admin/users/${f.userB.id}`)).status).toBe(404);
    expect((await as(tok.adminAB).get(`/api/admin/users/${f.userB.id}`)).status).toBe(200);
  });

  it('filters a shared user’s memberships to the caller’s platforms', async () => {
    const res = await as(tok.adminA).get(`/api/admin/users/${f.adminAB.id}`);
    expect(res.status).toBe(200);
    expect(res.body.memberships.map((m: { platformName: string }) => m.platformName)).toEqual(['Alpha']);
  });

  it('only lists the platforms a platform admin administers', async () => {
    const res = await as(tok.adminA).get('/api/admin/platforms');
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Alpha']);
    const all = await as(tok.super).get('/api/admin/platforms');
    expect(all.body).toHaveLength(2);
    expect(all.body.find((p: { name: string }) => p.name === 'Alpha').userCount).toBe(3);
  });
});

describe('super-admin only routes', () => {
  const routes = (): [string, string, object?][] => [
    ['get', '/api/admin/users/all'],
    ['post', '/api/admin/platforms', { name: 'Nope' }],
    ['delete', `/api/admin/platforms/${f.beta.id}`, { confirmName: 'Beta' }],
    ['get', `/api/admin/users/${f.userB.id}/sessions`],
    ['delete', `/api/admin/users/${f.userB.id}/sessions`],
    ['post', `/api/admin/users/${f.userB.id}/disable`, {}],
    ['post', `/api/admin/users/${f.userB.id}/enable`],
    ['get', '/api/admin/system/signing-keys'],
    ['get', '/api/admin/system/super-admins'],
    ['get', '/api/admin/analytics/platforms'],
  ];

  it('refuses an admin of every platform who is not a super-admin', async () => {
    for (const [method, url, body] of routes()) {
      const res = await (as(tok.adminAB) as Record<string, (u: string, b?: object) => Promise<{ status: number }>>)[method](url, body);
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(403);
    }
  });

  it('serves them to a super-admin', async () => {
    expect((await as(tok.super).get('/api/admin/users/all')).body.total).toBe(5);
    expect((await as(tok.super).get('/api/admin/system/super-admins')).body.map((u: { email: string }) => u.email)).toEqual([
      'super@test.dev',
    ]);
  });

  it('never exposes a signing key’s private half', async () => {
    const res = await as(tok.super).get('/api/admin/system/signing-keys');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/private|PEM|BEGIN/i);
  });
});

describe('analytics and audit scope', () => {
  it('defaults a super-admin to every platform and a platform admin to theirs', async () => {
    expect((await as(tok.super).get('/api/admin/analytics/summary')).status).toBe(200);
    expect((await as(tok.adminA).get('/api/admin/analytics/summary')).status).toBe(200);
  });

  it('does not let a platform admin ask for "all"', async () => {
    // "all" from a platform admin falls back to their own platform rather than everything.
    const res = await as(tok.adminA).get('/api/admin/audit?platformId=all&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: { platformId: string }) => i.platformId === f.alpha.id)).toBe(true);
  });
});
