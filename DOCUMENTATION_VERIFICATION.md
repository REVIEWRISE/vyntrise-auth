# Documentation Verification Report

What has been checked against the implementation, by what method, and — just as important — what
has **not** been.

**Date:** September 2, 2026
**Covers:** commit `f5f1afd`, version 1.3.0
**Method:** manual reading of source against docs, plus live checks against production

> The previous edition of this file (June 16, 2026) reported `Status: PASSED ✅`, `Accuracy 100%`,
> and `All code examples tested` across the board. Those scores were never measured, and by
> September they were wrong: the signing algorithm and the login flow had both changed underneath
> them. This edition only claims what was actually checked. Prefer leaving a row as *not checked*
> over marking it verified on the strength of a plausible-looking file.

---

## Verified

### Route inventory matches the README

Every route in `src/routes/*.ts` was enumerated and reconciled against the API Reference tables in
`README.md`. Nine endpoints were missing from the README and have been added: `POST /register`,
the three verify-email routes, `GET /api/auth/me`, `DELETE /api/account/sessions`, the admin
`PATCH`/`DELETE` user and invite routes, and `GET`/`PATCH /api/admin/platforms/:id`. The two
`/.well-known` routes were undocumented in the README and now have their own section.

**Method:** `grep -nE "router\.(get|post|patch|put|delete)"` across `src/routes/`, compared row by
row with the README tables.

### Login is gated on email verification, and cannot be used to enumerate accounts

`auth.controller.ts` checks `user.emailVerified` **after** password validation, so an unconfirmed
account and a wrong password are indistinguishable to an attacker probing addresses. Returns
`403` with `code: 'EMAIL_NOT_VERIFIED'`.

**Method:** read `login` in `src/controllers/auth.controller.ts`.

### The email-verification migration does not lock out existing users

`20260901120000_add_email_verification_and_signing_keys` ends with:

```sql
UPDATE "User" SET "emailVerified" = true, "emailVerifiedAt" = "createdAt";
```

Without this, adding the login gate would have locked out every account created before the
migration.

**Method:** read `migration.sql` in full before the deploy landed.

### RS256 signing is live in production

Checked against the running service on 2026-09-02:

| Check | Result |
|---|---|
| `GET /health` | `200`, `{"status":"ok"}` |
| `GET /.well-known/jwks.json` | One RSA key, `alg: RS256`, `use: sig` |
| `GET /.well-known/openid-configuration` | `issuer: https://auth.vyntrise.com` |

The JWKS response containing a key proves the migration ran, the `SigningKey` table exists, and a
key pair was generated on boot. The `issuer` value matches the string hardcoded in the `jose`
snippets in `README.md`, `/admin/docs`, and `/admin/platforms/[id]`, so those examples verify
successfully rather than throwing on an issuer mismatch.

### Both signing algorithms are accepted during the migration window

`auth.middleware.ts` delegates to `verifyToken`, which accepts RS256 and legacy HS256 while
pre-rotation tokens remain in circulation. Refresh tokens live 7 days, so the fallback is safe to
delete after 2026-09-08.

**Method:** read `src/middlewares/auth.middleware.ts` and `src/services/signing-key.service.ts`.

### Schema and migrations match the documented model list

Nine models (`User`, `Platform`, `UserPlatformAccess`, `Invitation`, `PasswordResetToken`,
`Session`, `AuditLog`, `EmailVerificationToken`, `SigningKey`) and six migrations, all listed in
`DOCUMENTATION_INDEX.md`.

**Method:** `grep -nE "^model " prisma/schema.prisma`, `ls prisma/migrations`.

### Environment variables exist and are read

`.env.example` documents `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`SIGNING_KEY_SECRET`, `OIDC_ISSUER`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, `PORT`, `NODE_ENV`, and
the email settings. `SIGNING_KEY_SECRET` is read in `signing-key.service.ts`, `OIDC_ISSUER` in
`config/oidc.ts`, and all `SMTP_*` / `GMAIL_*` / `EMAIL_*` variables in `config/email.ts`.

**Correction to the June edition:** it stated `SMTP_* variables - Used in smtp.provider.ts`. They
are read in `config/email.ts`; the provider receives already-validated config.

### CI is green

Run `33628097142` — lint, type-check, image build, and deploy all passed. Frontend
`tsc --noEmit` exits 0.

---

## Not verified

### SMTP authentication ⚠️

**Nothing has confirmed that the configured SMTP host accepts our credentials.** This is the
highest-consequence gap in this report. Since 1.3.0, a self-registered user cannot sign in until
they click a link in an email. If SMTP authentication is failing, self-registration is broken end
to end — accounts are created, no mail arrives, and those users can never log in. Existing
accounts are unaffected, because the migration grandfathered them.

It cannot be checked from outside: the resend endpoint deliberately responds identically whether
or not mail was sent. Settle it on the server with:

```bash
docker logs vyntrise-auth-backend 2>&1 | grep -iE "\[email\]|SmtpProvider"
```

`✅ Connection verified, ready to send` means it works.

### There is no automated test suite

`apps/backend` has `"test": "echo \"Error: no test specified\" && exit 1"`; the frontend has no
test script. No `*.test.ts` or `*.spec.ts` files exist anywhere in the repo.

The June edition's "Test Coverage" section — *Authentication flows work as documented ✅*,
*Code examples compile without errors ✅* — described tests that do not exist. Treat every
behavioural claim in the guides as unverified by execution unless this report says otherwise.

### Code examples in the guides have not been executed

The `jose` verification snippet is consistent across all three places it appears and its issuer
matches production, but it has not been run against a real token from an integrator's codebase.

### Not re-checked this pass

- `CORS_SETUP_GUIDE.md` — last verified June 2026. CORS handling has not changed, but the guide
  has not been reread against `server.ts`
- Frontend flows (`/verify-email`, `/register`, account pages) — not exercised in a browser
- `INTEGRATION_TESTING_GUIDE.md` scenarios — not run
- `examples/nextjs-integration/lib/authApi.ts` — updated for RS256 in `4f6ef34`, not executed

---

## Known gaps and risks

### `iss` is derived from a variable named for something else

`config/oidc.ts` falls back to `FRONTEND_URL` when `OIDC_ISSUER` is unset. Editing `FRONTEND_URL`
for an unrelated reason would silently change the `iss` claim and break every integrator's
signature verification with an unhelpful error. **Set `OIDC_ISSUER` explicitly in production.**

### `SMTP_FROM` is undocumented in `.env.example`

Read as a legacy alias in `config/email.ts` and documented in `EMAIL_SETUP.md`, but absent from
`.env.example`. Harmless — `EMAIL_FROM` supersedes it — but worth noting.

### Rate limiting is per-process

`rate-limit.middleware.ts` keeps counters in memory. Correct for the current single-instance
deployment; a multi-instance deployment would need a shared store, and the documented limits
would no longer hold.

### Integrators may still be on HS256

The grace window ends when the last pre-rotation refresh token expires. Anyone still verifying
with a shared `JWT_SECRET` starts failing then. They have not been individually notified.

---

## How to update this report

When you change behaviour, re-check the affected row and move it between **Verified** and **Not
verified** as the evidence warrants. Record the method, not just the conclusion — a claim without
a method is what made the previous edition useless. If something was not checked, leave it under
*Not verified*; an honest gap is more useful to the next reader than a green tick that is not
true.
