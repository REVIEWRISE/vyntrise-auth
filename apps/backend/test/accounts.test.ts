import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app, as, login, prisma, seed, tokenFor, type Fixtures } from './helpers';

// Disabling, sessions and verification: the account-level controls, which span every platform.

let f: Fixtures;
let superTok: string;

beforeEach(async () => {
  f = await seed();
  superTok = await tokenFor('super@test.dev');
});

describe('disabling an account', () => {
  it('signs the user out everywhere and keeps them out', async () => {
    const victim = await login('user-b@test.dev', f.beta.id);
    expect((await as(victim.token).get('/api/account/me')).status).toBe(200);

    const res = await as(superTok).post(`/api/admin/users/${f.userB.id}/disable`, { reason: 'left the company' });
    expect(res.status).toBe(200);
    expect(res.body.sessionsRevoked).toBe(1);

    // The live access token dies on its next request, with the wording apiFetch treats as a
    // forced sign-out.
    const me = await as(victim.token).get('/api/account/me');
    expect(me.status).toBe(401);
    expect(me.body.message).toMatch(/revoked/i);

    // The refresh cookie cannot mint a new one.
    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', victim.refreshCookie!);
    expect(refresh.status).toBe(403);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: f.userB.id } });
    expect(user.disabledReason).toBe('left the company');
    expect(user.disabledById).toBe(f.superAdmin.id);
  });

  it('reveals the disabled state only to someone who knows the password', async () => {
    await as(superTok).post(`/api/admin/users/${f.userB.id}/disable`, {});

    const wrong = await login('user-b@test.dev', undefined, 'not-the-password');
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBeUndefined();

    const right = await login('user-b@test.dev');
    expect(right.status).toBe(403);
    expect(right.body.code).toBe('ACCOUNT_DISABLED');
  });

  it('can be undone', async () => {
    await as(superTok).post(`/api/admin/users/${f.userB.id}/disable`, {});
    expect((await as(superTok).post(`/api/admin/users/${f.userB.id}/enable`)).status).toBe(200);
    expect((await login('user-b@test.dev', f.beta.id)).status).toBe(200);
  });

  it('answers 409 when there is nothing to change', async () => {
    expect((await as(superTok).post(`/api/admin/users/${f.userB.id}/enable`)).status).toBe(409);
    await as(superTok).post(`/api/admin/users/${f.userB.id}/disable`, {});
    expect((await as(superTok).post(`/api/admin/users/${f.userB.id}/disable`, {})).status).toBe(409);
  });

  it('refuses to disable yourself', async () => {
    expect((await as(superTok).post(`/api/admin/users/${f.superAdmin.id}/disable`, {})).status).toBe(400);
  });

  // The "last active super-admin" guard in disableUser cannot be reached through the API: the
  // caller is itself an active super-admin and may not target itself, so another always exists.
  // It stays as defence in depth; what is reachable is one super-admin disabling another.
  it('lets one super-admin disable another, who loses the console at once', async () => {
    const second = await prisma.user.update({ where: { id: f.adminA.id }, data: { isSuperAdmin: true } });
    const secondTok = await tokenFor(second.email);
    await as(superTok).post(`/api/admin/users/${second.id}/disable`, {});
    expect((await as(secondTok).get('/api/admin/me')).status).toBe(401);
  });
});

describe('sessions', () => {
  it('lists a user’s sessions with the client IP, and revokes them one at a time', async () => {
    await login('user-b@test.dev', f.beta.id);
    await login('user-b@test.dev', f.beta.id);

    const list = await as(superTok).get(`/api/admin/users/${f.userB.id}/sessions`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].ipAddress).toBeTruthy();

    const id = list.body[0].id;
    expect((await as(superTok).delete(`/api/admin/users/${f.userB.id}/sessions/${id}`)).body.count).toBe(1);
    expect((await as(superTok).delete(`/api/admin/users/${f.userB.id}/sessions/${id}`)).status).toBe(404);
    expect(await prisma.session.count({ where: { userId: f.userB.id } })).toBe(1);
  });

  it('signs a user out everywhere', async () => {
    await login('user-b@test.dev', f.beta.id);
    await login('user-b@test.dev', f.beta.id);
    const res = await as(superTok).delete(`/api/admin/users/${f.userB.id}/sessions`);
    expect(res.body.count).toBe(2);
    expect(await prisma.session.count({ where: { userId: f.userB.id } })).toBe(0);
  });

  it('cannot revoke another user’s session through a different user’s path', async () => {
    const other = await login('admin-a@test.dev', f.alpha.id);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: f.adminA.id } });
    const res = await as(superTok).delete(`/api/admin/users/${f.userB.id}/sessions/${session.id}`);
    expect(res.status).toBe(404);
    expect((await as(other.token).get('/api/account/me')).status).toBe(200);
  });

  it('marks the caller’s own session', async () => {
    const res = await as(superTok).get(`/api/admin/users/${f.superAdmin.id}/sessions`);
    expect(res.body.filter((s: { isCurrent: boolean }) => s.isCurrent)).toHaveLength(1);
  });
});

describe('resending verification', () => {
  it('lets a platform admin resend to an unverified member of their platform', async () => {
    const tok = await tokenFor('admin-a@test.dev');
    expect((await as(tok).post(`/api/admin/users/${f.unverified.id}/resend-verification`)).status).toBe(200);
    expect(await prisma.emailVerificationToken.count({ where: { userId: f.unverified.id } })).toBe(1);
  });

  it('answers 409 for an address that is already confirmed', async () => {
    expect((await as(superTok).post(`/api/admin/users/${f.userB.id}/resend-verification`)).status).toBe(409);
  });

  it('hides users outside the caller’s platforms', async () => {
    const tok = await tokenFor('admin-a@test.dev');
    expect((await as(tok).post(`/api/admin/users/${f.userB.id}/resend-verification`)).status).toBe(404);
  });
});

describe('user lists', () => {
  it('pages, searches and filters a platform’s members', async () => {
    const tok = await tokenFor('admin-a@test.dev');
    const all = await as(tok).get(`/api/admin/users?platformId=${f.alpha.id}&pageSize=2`);
    expect(all.body.total).toBe(3);
    expect(all.body.items).toHaveLength(2);

    const admins = await as(tok).get(`/api/admin/users?platformId=${f.alpha.id}&role=ADMIN`);
    expect(admins.body.items.map((u: { email: string }) => u.email).sort()).toEqual(['admin-a@test.dev', 'admin-ab@test.dev']);

    const unverified = await as(tok).get(`/api/admin/users?platformId=${f.alpha.id}&status=unverified`);
    expect(unverified.body.items.map((u: { email: string }) => u.email)).toEqual(['unverified@test.dev']);

    const search = await as(tok).get(`/api/admin/users?platformId=${f.alpha.id}&q=AB@`);
    expect(search.body.items.map((u: { email: string }) => u.email)).toEqual(['admin-ab@test.dev']);
  });

  it('includes every account and its platforms in the global list', async () => {
    const res = await as(superTok).get('/api/admin/users/all?q=admin-ab');
    expect(res.body.items[0].platforms.map((p: { name: string }) => p.name).sort()).toEqual(['Alpha', 'Beta']);
  });

  it('records the last sign-in', async () => {
    await login('user-b@test.dev', f.beta.id);
    await new Promise((r) => setTimeout(r, 100));
    const res = await as(superTok).get(`/api/admin/users/${f.userB.id}`);
    expect(res.body.lastLoginAt).toBeTruthy();
    expect(res.body.sessionCount).toBe(1);
  });
});
