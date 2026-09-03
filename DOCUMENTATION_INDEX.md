# Vyntrise Auth Documentation Index

Complete guide to all documentation in the Vyntrise Auth monorepo.

**Last updated:** September 2, 2026 · **Version:** 1.3.0

---

## 📘 Core Documentation

### 1. [README.md](./README.md)
**Main project overview and getting started guide**

Contents:
- Repository structure
- Getting started instructions
- Environment variables, including email and signing-key settings
- Authentication flow explanation
- API reference (all endpoints)
- Database schema overview
- Deployment instructions
- Quick links to integration guides

**Start here** if you're new to the project.

---

### 2. [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md)
**Step-by-step guide for integrating external platforms**

Contents:
- Platform creation in admin panel
- User invitation system
- SSO redirect configuration (`redirectUrl` is restricted to `vyntrise.com` subdomains)
- Callback handling
- Token usage and API calls
- Token refresh flow
- JWT payload structure
- **RS256 verification against the JWKS endpoint**
- Security notes and quick reference table

**Use this** when setting up a new platform (e.g. vyntrise-sms, vyntrise-crm).

---

### 3. [SSO_SESSION_VALIDATION_GUIDE.md](./SSO_SESSION_VALIDATION_GUIDE.md)
**Implementation guide for session revocation in external platforms**

Contents:
- Session validation overview
- Step-by-step implementation instructions
- API client / fetch wrapper implementation
- Middleware examples (Next.js, Express, Django)
- User notification handling
- Environment variable configuration
- Performance optimization with caching
- Testing procedures and troubleshooting

**Use this** to enforce session revocation in your platform. Revocation is enforced for
Bearer-only callers as of 1.1.0 — if you integrated before then, re-read this.

---

### 4. [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md)
**Testing checklist for platform integrations**

Contents:
- Pre-integration checklist
- Test scenarios covering login, refresh, revocation, and platform access
- API endpoint verification
- Code verification checklist
- Common issues and fixes
- Security and load testing notes

**Use this** to verify your integration works correctly.

---

### 5. [CORS_SETUP_GUIDE.md](./CORS_SETUP_GUIDE.md)
**CORS configuration and troubleshooting**

Contents:
- What CORS is and why it matters here
- Backend configuration (`ALLOWED_ORIGINS`)
- Frontend configuration (`credentials: 'include'`)
- Common CORS errors and solutions
- Development vs production setup
- Subdomain strategies and security notes

**Use this** when hitting CORS errors or onboarding a new platform origin.
*Unchanged since June 2026 — CORS handling has not changed since.*

---

## 🖥️ In-Product Documentation

The admin portal ships its own integration guides, and those are the ones platform owners
actually read. They are code, not markdown, so keep them in sync when the API changes.

### 6. `/admin/docs` — [apps/frontend/app/admin/docs/page.tsx](./apps/frontend/app/admin/docs/page.tsx)
General SSO integration guide: login redirect, callback, token verification, session handling.

### 7. `/admin/platforms/[id]` — [apps/frontend/app/admin/platforms/\[id\]/page.tsx](./apps/frontend/app/admin/platforms/%5Bid%5D/page.tsx)
Per-platform guide with that platform's real IDs and URLs filled in: sign-up and login links,
email confirmation flow, token verification, and an endpoint reference table.

---

## 🔧 Backend Documentation

### 8. [apps/backend/EMAIL_SETUP.md](./apps/backend/EMAIL_SETUP.md)
**Email service configuration guide**

Contents:
- Console provider (development — logs, sends nothing)
- SMTP provider (production — any host)
- Gmail provider (low volume)
- Configuration for SendGrid, Mailgun, AWS SES
- Email template information
- Testing instructions and troubleshooting

**Use this** when configuring email sending. As of 1.3.0 email delivery is load-bearing:
self-registered users cannot sign in until they confirm their address.

---

### 9. [apps/backend/.env.example](./apps/backend/.env.example)
**Environment variables template**

Covers `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SIGNING_KEY_SECRET`, `OIDC_ISSUER`,
`FRONTEND_URL`, `ALLOWED_ORIGINS`, `PORT`, `NODE_ENV`, and the email settings
(`EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_*`, `GMAIL_*`).

---

## 💡 Examples & Reference Implementations

### 10. [examples/nextjs-integration/](./examples/nextjs-integration/)
**Next.js integration example with session revocation**

Files:
- `lib/authApi.ts` — auth API client with session detection
- `.env.example` — environment configuration
- `README.md` — quick start guide

---

## 🗂️ Database & Schema

### 11. [apps/backend/prisma/schema.prisma](./apps/backend/prisma/schema.prisma)
**Database schema definition**

Models:
- `User` (includes `emailVerified`, `emailVerifiedAt`)
- `Platform` (includes `allowSelfRegistration`)
- `UserPlatformAccess`
- `Invitation` (platform and role)
- `PasswordResetToken`
- `Session`
- `AuditLog`
- `EmailVerificationToken`
- `SigningKey`

Migrations, in order:

| Migration | Adds |
|-----------|------|
| `20260615142150_add_session_and_password_reset_token` | `Session`, `PasswordResetToken` |
| `20260616124142_add_role_to_invitation` | `Invitation.role` |
| `20260821200327_add_audit_log` | `AuditLog` |
| `20260821201914_cascade_delete_user_platform_access` | Cascade delete |
| `20260825094500_add_platform_self_registration` | `Platform.allowSelfRegistration` |
| `20260901120000_add_email_verification_and_signing_keys` | `EmailVerificationToken`, `SigningKey`, `User.emailVerified*` (backfilled `true` for existing accounts) |

---

## 📊 Documentation Summary

| Document | Purpose | Audience | Last updated |
|----------|---------|----------|--------------|
| README.md | Project overview | All developers | 2026-09-02 |
| SSO_INTEGRATION_GUIDE.md | Platform integration | Platform developers | 2026-09-01 |
| SSO_SESSION_VALIDATION_GUIDE.md | Session revocation | Platform developers | 2026-09-01 |
| INTEGRATION_TESTING_GUIDE.md | Integration testing | Platform developers | 2026-09-01 |
| CORS_SETUP_GUIDE.md | CORS configuration | All developers | 2026-06-16 |
| EMAIL_SETUP.md | Email configuration | Backend developers | 2026-08-28 |
| CHANGELOG.md | Version history | All developers | 2026-09-02 |
| DOCUMENTATION_VERIFICATION.md | What has been checked, and what has not | Maintainers | 2026-09-02 |
| .env.example | Environment setup | DevOps/Backend | 2026-09-01 |
| examples/nextjs-integration/ | Reference implementation | Frontend developers | 2026-09-01 |
| `/admin/docs` (in-product) | SSO integration | Platform owners | 2026-09-01 |
| `/admin/platforms/[id]` (in-product) | Per-platform guide | Platform owners | 2026-09-02 |

---

## 🎯 Quick Navigation by Task

### I want to...

#### Set up a new platform
1. Read [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md)
2. Create the platform in the admin panel
3. Open its page under **Platforms** for a guide with your real IDs filled in

#### Verify tokens in my platform
1. Fetch `https://auth.vyntrise.com/.well-known/jwks.json`
2. Verify with the `jose` library — `createRemoteJWKSet` plus `jwtVerify`, issuer
   `https://auth.vyntrise.com`
3. Do **not** use `JWT_SECRET`. See the 1.3.0 entry in [CHANGELOG.md](./CHANGELOG.md)

#### Implement session revocation
1. Read [SSO_SESSION_VALIDATION_GUIDE.md](./SSO_SESSION_VALIDATION_GUIDE.md)
2. Copy [examples/nextjs-integration/lib/authApi.ts](./examples/nextjs-integration/lib/authApi.ts)
3. Run the tests in [INTEGRATION_TESTING_GUIDE.md](./INTEGRATION_TESTING_GUIDE.md)

#### Configure email sending
1. Read [apps/backend/EMAIL_SETUP.md](./apps/backend/EMAIL_SETUP.md)
2. Choose a provider (`console`, `smtp`, or `gmail`)
3. Set the credentials, restart, and **check the boot log** — a provider with missing credentials
   falls back to console rather than failing at send time
4. Test with a password reset or an invitation

#### Deploy to production
1. Review [README.md - Deployment](./README.md#deployment)
2. Set production environment variables, including `SIGNING_KEY_SECRET` and `OIDC_ISSUER`
3. Run `npx prisma migrate deploy`
4. Confirm `/.well-known/jwks.json` returns a key

---

## 🔄 Recent Updates

### Email verification and RS256 signing (1.3.0)
- Tokens signed with RSA; public keys published at `/.well-known/jwks.json`
- Discovery document at `/.well-known/openid-configuration`
- Self-registered users confirm their email before their first sign-in
- HS256 still accepted during the migration window — see CHANGELOG for the deadline

### Email configuration and delivery (1.2.0)
- One validated config module for every email setting
- Generic SMTP provider, shared templates, security notification emails

### Hardening and platform management (1.1.0)
- Session revocation enforced for Bearer-only callers
- Audit log, per-platform member management, invite revocation
- Opt-in self-registration per platform
- Rate limiting on unauthenticated endpoints

---

## 📞 Getting Help

**Q: Where do I start?**
A: [README.md](./README.md), then [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md).

**Q: How do I verify a token now?**
A: Against [`/.well-known/jwks.json`](https://auth.vyntrise.com/.well-known/jwks.json). The
shared-`JWT_SECRET` approach is deprecated and will stop working once the last pre-rotation
token expires.

**Q: A user registered but cannot log in.**
A: They likely have not confirmed their email. Login returns `403` with
`code: 'EMAIL_NOT_VERIFIED'`. A fresh link can be requested via
`POST /api/auth/resend-verification`.

**Q: How do I configure email?**
A: [EMAIL_SETUP.md](./apps/backend/EMAIL_SETUP.md).

**Q: What is the database structure?**
A: [schema.prisma](./apps/backend/prisma/schema.prisma) and the Database Schema section of
[README.md](./README.md).

**Q: How do invitations work?**
A: Invitations are platform-specific and skip email verification, since the invite email already
proved control of the address. See Step 2 in
[SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md).

---

## Keeping this index honest

This file goes stale silently — it sat unchanged from June to September 2026 while the signing
algorithm and the login flow both changed underneath it. When you add or change a documented
feature, update the affected guide **and** the Last updated column above. Anything not listed
here is undocumented; say so rather than assuming coverage exists.
