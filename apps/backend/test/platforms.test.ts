import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { app, as, prisma, seed, settle, tokenFor, type Fixtures } from './helpers';

let f: Fixtures;
let superTok: string;
let adminATok: string;

beforeAll(async () => {
  f = await seed();
  superTok = await tokenFor('super@test.dev');
  adminATok = await tokenFor('admin-a@test.dev');
});

afterEach(() => {
  delete process.env.ALLOW_LOCALHOST_REDIRECT;
  delete process.env.LEGACY_REDIRECT_FALLBACK;
});

const patchAlpha = (body: object) => as(adminATok).patch(`/api/admin/platforms/${f.alpha.id}`, body);

describe('PATCH /api/admin/platforms/:id — redirect URIs and origins', () => {
  it.each([
    [{ redirectUris: ['ftp://app.alpha.dev/cb'] }, /https/],
    [{ redirectUris: ['https://*.alpha.dev/cb'] }, /Wildcard/],
    [{ redirectUris: ['not a url'] }, /valid absolute URL/],
    [{ redirectUris: ['https://app.alpha.dev/cb?x=1'] }, /query string/],
    [{ redirectUris: ['https://user:pw@app.alpha.dev/cb'] }, /credentials/],
    [{ redirectUris: Array.from({ length: 21 }, (_, i) => `https://a${i}.alpha.dev/cb`) }, /At most 20/],
    [{ allowedOrigins: ['https://app.alpha.dev/path'] }, /bare origin/],
    [{ redirectUris: 'https://app.alpha.dev/cb' }, /array/],
  ])('rejects %j', async (body, message) => {
    const res = await patchAlpha(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it('rejects plain-http localhost when localhost redirects are disabled', async () => {
    process.env.NODE_ENV = 'production';
    try {
      const res = await patchAlpha({ redirectUris: ['http://localhost:4000/cb'] });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Localhost/);
      process.env.ALLOW_LOCALHOST_REDIRECT = 'true';
      expect((await patchAlpha({ redirectUris: ['http://localhost:4000/cb'] })).status).toBe(200);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });

  it('normalises, de-duplicates and audits the change', async () => {
    const res = await patchAlpha({
      redirectUris: ['https://APP.alpha.dev/auth/callback', 'https://app.alpha.dev/auth/callback', 'http://localhost:4000/cb'],
      allowedOrigins: ['https://app.alpha.dev/'],
    });
    expect(res.status).toBe(200);
    expect(res.body.redirectUris).toEqual(['https://app.alpha.dev/auth/callback', 'http://localhost:4000/cb']);
    expect(res.body.allowedOrigins).toEqual(['https://app.alpha.dev']);

    await settle();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'PLATFORM_SECURITY_CHANGED', platformId: f.alpha.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.metadata).toMatchObject({ allowedOrigins: { from: [], to: ['https://app.alpha.dev'] } });
  });

  it('marks changes a super-admin makes to a platform they are not a member of', async () => {
    await as(superTok).patch(`/api/admin/platforms/${f.beta.id}`, { allowSelfRegistration: false });
    await settle();
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'PLATFORM_SETTINGS_CHANGED', platformId: f.beta.id } });
    expect(audit.metadata).toMatchObject({ viaSuperAdmin: true });
    await as(superTok).patch(`/api/admin/platforms/${f.beta.id}`, { allowSelfRegistration: true });
  });

  it('renames, refusing a name another platform already has', async () => {
    expect((await patchAlpha({ name: 'Beta' })).status).toBe(409);
    expect((await patchAlpha({ name: '   ' })).status).toBe(400);
    expect((await patchAlpha({ name: 'Alpha', description: 'Updated' })).body.description).toBe('Updated');
  });
});

describe('GET /api/auth/redirect-check', () => {
  const check = async (redirectUrl: string, platformId: string = f.alpha.id) =>
    (await request(app).get('/api/auth/redirect-check').query({ platformId, redirectUrl })).body.allowed as boolean;

  beforeAll(async () => {
    await prisma.platform.update({
      where: { id: f.alpha.id },
      data: { redirectUris: ['https://app.alpha.dev/auth/callback', 'http://localhost:4000/cb'] },
    });
  });

  it.each([
    ['https://app.alpha.dev/auth/callback', true],
    ['https://app.alpha.dev/auth/callback/deeper?next=/x', true],
    ['https://app.alpha.dev/auth/callback-evil', false],
    ['https://app.alpha.dev/other', false],
    ['https://evil.com/auth/callback', false],
    ['https://app.alpha.dev.evil.com/auth/callback', false],
    ['https://user@app.alpha.dev/auth/callback', false],
    ['javascript:alert(1)', false],
    ['http://app.alpha.dev/auth/callback', false],
    ['https://app.alpha.dev/auth/callback/error', false],
    ['not a url', false],
    // A configured platform no longer gets the legacy *.vyntrise.com allowance.
    ['https://app.vyntrise.com/cb', false],
  ])('platform with redirect URIs: %s → %s', async (url, allowed) => {
    expect(await check(url)).toBe(allowed);
  });

  it('allows a registered localhost URI only while localhost redirects are enabled', async () => {
    expect(await check('http://localhost:4000/cb')).toBe(true); // NODE_ENV=test is not production
    process.env.NODE_ENV = 'production';
    try {
      expect(await check('http://localhost:4000/cb')).toBe(false);
      process.env.ALLOW_LOCALHOST_REDIRECT = 'true';
      expect(await check('http://localhost:4000/cb')).toBe(true);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  });

  it('applies the legacy rule to a platform with no redirect URIs, until it is switched off', async () => {
    expect(await check('https://app.vyntrise.com/cb', f.beta.id)).toBe(true);
    expect(await check('https://vyntrise.com/cb', f.beta.id)).toBe(true);
    expect(await check('https://app.vyntrise.com.evil.com/cb', f.beta.id)).toBe(false);
    expect(await check('http://app.vyntrise.com/cb', f.beta.id)).toBe(false);
    expect(await check('https://vyntrise.com/cb', '')).toBe(true);

    process.env.LEGACY_REDIRECT_FALLBACK = 'false';
    expect(await check('https://app.vyntrise.com/cb', f.beta.id)).toBe(false);
  });

  it('answers with nothing but a boolean', async () => {
    const res = await request(app).get('/api/auth/redirect-check').query({ platformId: f.alpha.id, redirectUrl: 'https://x.dev' });
    expect(res.body).toEqual({ allowed: false });
  });
});

describe('CORS', () => {
  it('accepts origins registered on a platform alongside ALLOWED_ORIGINS', async () => {
    // Through the API, which is what refreshes the in-memory origin cache.
    await as(superTok).patch(`/api/admin/platforms/${f.beta.id}`, { allowedOrigins: ['https://app.beta.dev'] });

    const allowed = await request(app).get('/api/health').set('Origin', 'https://app.beta.dev');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.beta.dev');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const env = await request(app).get('/api/health').set('Origin', 'http://localhost:3001');
    expect(env.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.dev');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('stops accepting an origin as soon as it is removed', async () => {
    await as(superTok).patch(`/api/admin/platforms/${f.beta.id}`, { allowedOrigins: [] });
    const res = await request(app).get('/api/health').set('Origin', 'https://app.beta.dev');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('invite keys', () => {
  it('keeps a history in which rotating revokes the previous key', async () => {
    const first = await as(adminATok).post(`/api/admin/platforms/${f.alpha.id}/invite-key`);
    const second = await as(adminATok).post(`/api/admin/platforms/${f.alpha.id}/invite-key`);
    expect(first.body.rawKey).toBeTruthy();
    expect(second.body.rawKey).not.toBe(first.body.rawKey);

    const history = await as(adminATok).get(`/api/admin/platforms/${f.alpha.id}/invite-keys`);
    expect(history.body).toHaveLength(2);
    expect(history.body.filter((k: { revokedAt: string | null }) => !k.revokedAt)).toHaveLength(1);
    expect(history.body[0].createdByEmail).toBe('admin-a@test.dev');
    expect(JSON.stringify(history.body)).not.toContain(second.body.rawKey);
  });
});

describe('creating and deleting platforms', () => {
  it('lets a super-admin create a platform and become its admin', async () => {
    const res = await as(superTok).post('/api/admin/platforms', { name: 'Gamma' });
    expect(res.status).toBe(201);
    const access = await prisma.userPlatformAccess.findUnique({
      where: { userId_platformId: { userId: f.superAdmin.id, platformId: res.body.id } },
    });
    expect(access?.role).toBe('ADMIN');
    expect((await as(superTok).post('/api/admin/platforms', { name: 'Gamma' })).status).toBe(409);
  });

  it('deletes a platform with members, invitations and keys, keeping its audit trail', async () => {
    const created = await as(superTok).post('/api/admin/platforms', { name: 'Doomed' });
    const id = created.body.id;
    await as(superTok).post('/api/admin/invites', { platformId: id, email: 'someone-new@test.dev' });
    await as(superTok).post(`/api/admin/platforms/${id}/invite-key`);
    await settle();

    expect((await as(superTok).delete(`/api/admin/platforms/${id}`, { confirmName: 'doomed' })).status).toBe(400);
    expect((await as(superTok).delete(`/api/admin/platforms/${id}`)).status).toBe(400);
    expect((await as(superTok).delete(`/api/admin/platforms/${id}`, { confirmName: 'Doomed' })).status).toBe(200);
    await settle();

    expect(await prisma.platform.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.invitation.count({ where: { platformId: id } })).toBe(0);
    expect(await prisma.platformInviteKey.count({ where: { platformId: id } })).toBe(0);
    expect(await prisma.userPlatformAccess.count({ where: { platformId: id } })).toBe(0);

    const trail = await prisma.auditLog.findMany({ where: { targetId: id } });
    expect(trail.map((r) => r.action)).toEqual(expect.arrayContaining(['PLATFORM_CREATED', 'PLATFORM_DELETED']));
    expect(trail.every((r) => r.platformId === null)).toBe(true);
    expect(trail.find((r) => r.action === 'PLATFORM_DELETED')!.metadata).toMatchObject({ name: 'Doomed', platformId: id });
  });
});
