 # Changelog

All notable changes to the Vyntrise Auth project.

---

## [1.4.0] - 2026-09-03

### Features

#### Platform-scoped invite keys

A platform's own backend can now create invitations for itself, so onboarding a user is one
action in that platform's admin UI instead of a second one in this app.

- **`POST /api/admin/platforms/:platformId/invites`** — server-to-server, authenticated by
  `Authorization: Bearer <invite key>` rather than a user session
- **Key management** on the platform's own admin page, next to Self-Registration:
  `POST`/`DELETE /api/admin/platforms/:id/invite-key`. The key is shown once and cannot be
  retrieved afterwards, only replaced
- **New model `PlatformInviteKey`** — stores a SHA-256 digest of the key, the same treatment
  invite and reset tokens already get, plus a short non-secret prefix so the admin page can show
  which key is live

#### Scope, deliberately narrow

- A key is bound to one platform at creation. Presenting it against a different `:platformId`
  is rejected `401` — not `403`, which would confirm the other platform exists. This is the
  whole reason it is not a general admin API key: a leaked key can only invite people into the
  platform it was issued for, which is no more than a human admin of that platform already has
- Role is fixed at `USER`. `ADMIN` grants access to this service's admin panel, so a platform
  backend must never be able to mint it — inviting an admin still goes through the human form
- Rate limited per key: 20/min, 200/hour, and 5/hour to any single address, mirroring the
  ceilings on resend-verification since this endpoint also sends mail

### Internal

- `createInvitation` extracted to `services/invite.service.ts` and shared by the admin form and
  the API, so an invitation created either way is the same record — same 7-day expiry, same
  email, same Revoke button, and invited users still skip email confirmation
- `INVITE_CREATED` audit entries gained an `origin` field (`admin` or `api`) and, for API calls,
  the key id. Extends the existing trail rather than adding a parallel one
- New audit actions `INVITE_KEY_CREATED` and `INVITE_KEY_REVOKED`

---

## [1.3.0] - 2026-09-02

### ⚠️ Breaking for platform integrators

#### RS256 token signing + JWKS

Access and refresh tokens are now signed with an RSA private key that never leaves this
service. Integrators verify with the **public** key published at
`https://auth.vyntrise.com/.well-known/jwks.json`.

- **Backend**: `signing-key.service.ts` generates and rotates an RSA key pair, stored in the new
  `SigningKey` table (private half encrypted at rest with `SIGNING_KEY_SECRET`)
- **Discovery**: `/.well-known/openid-configuration` and `/.well-known/jwks.json`, also mounted
  under `/api/.well-known` for proxies that only forward `/api`
- **Issuer**: `OIDC_ISSUER`, falling back to `FRONTEND_URL`. Production resolves to
  `https://auth.vyntrise.com`
- **Grace period**: `auth.middleware.ts` accepts HS256 *and* RS256 while pre-rotation tokens are
  still in circulation. Refresh tokens live 7 days, so the HS256 fallback in
  `signing-key.service.ts` can be deleted any time after 2026-09-08

**Why**: `JWT_SECRET` is symmetric — the same value that verifies a token can also mint one. Any
product given that secret so it could check logins could equally forge an admin token for every
other product. Asymmetric signing splits those powers.

**Action required**: stop sharing `JWT_SECRET`. Verify against the JWKS endpoint instead:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://auth.vyntrise.com/.well-known/jwks.json'));

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: 'https://auth.vyntrise.com' });
  return payload;
}
```

Integrators still on HS256 keep working until their last pre-rotation token expires, then start
failing. Migrate before then.

---

### 🎉 Features

#### Email verification

Self-registered accounts must confirm their email address before they can sign in.

- **Backend**: `email-verification.controller.ts` — issue, validate, and consume single-use
  tokens (24h expiry) in the new `EmailVerificationToken` table
- **Login gate**: `login` returns `403` with `code: 'EMAIL_NOT_VERIFIED'` for unconfirmed
  accounts. Checked *after* password validation, so it cannot be used to enumerate accounts
- **Frontend**: `/verify-email` page, plus resend handling on `/login`
- **Invited users**: skip verification — the invite email already proved control of the address
- **Email changes**: clear `emailVerified`, requiring reconfirmation

**Migration safety**: `20260901120000_add_email_verification_and_signing_keys` backfills
`emailVerified = true` for every account created before the migration. Without it, the new login
gate would have locked out the entire existing user base.

#### Endpoints added

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/register` | Self-registration (opt-in per platform) |
| `GET /api/auth/verify-email/:token` | Validate a confirmation token |
| `POST /api/auth/verify-email` | Consume it and mark the address confirmed |
| `POST /api/auth/resend-verification` | Request a fresh link |
| `GET /.well-known/jwks.json` | Public signing keys |
| `GET /.well-known/openid-configuration` | Discovery document |

### 🔐 Security

- Rate limits on every verification route: resend 5/15min per IP+email and 5/hour per email;
  validate/consume 20/15min
- Resend responds identically whether or not the address exists, to avoid disclosure

### 📚 Documentation

- `README.md`, `SSO_INTEGRATION_GUIDE.md`, `SSO_SESSION_VALIDATION_GUIDE.md`,
  `INTEGRATION_TESTING_GUIDE.md`, `examples/nextjs-integration/README.md` updated for RS256
- In-product guides updated: `/admin/docs` and the per-platform page at
  `/admin/platforms/[id]`

---

## [1.2.0] - 2026-08-28

### 🎉 Features

#### Email configuration and delivery

- **`config/email.ts`**: NEW — one validated source of truth for every email setting. A provider
  with missing credentials logs an error and falls back to console rather than throwing at send
  time, so a misconfiguration surfaces in the boot log instead of mid-request
- **`smtp.provider.ts`**: reworked to target any SMTP host. `SMTP_SECURE` defaults to `true` for
  port 465, `false` otherwise
- **Sender identity**: `EMAIL_FROM` / `EMAIL_FROM_NAME` apply across providers. `EMAIL_FROM`
  defaults to `SMTP_USER`/`GMAIL_USER`, but only when that value is itself an address — SendGrid
  and similar authenticate as the literal string `apikey`, which is not usable in a `From` header
- **Templates**: `email-templates/` — a shared layout plus HTML and plain-text bodies per email
- **Security notifications**: password change, email change, and new-session emails, sent
  fire-and-forget via `notify()` so a mail failure never fails the request that triggered it

### 🔧 Configuration

New: `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_SECURE`. `SMTP_FROM` remains a legacy alias.

---

## [1.1.0] - 2026-08-26

### 🎉 Features

#### Platform member management
- Change a user's role within a platform, remove a user from a platform
- Revoke a pending invitation
- "Sign out everywhere" — `DELETE /api/account/sessions` revokes every other session

#### Opt-in self-registration
- `Platform.allowSelfRegistration` (default `false`) — existing invite-only platforms unaffected
- `POST /api/auth/register` with `{ email, password, platformId }`; role is always hardcoded to
  `USER` server-side
- An email that already has an account is rejected rather than silently granted platform access

#### Audit log
- New `AuditLog` model records authentication and administrative actions

### 🔐 Security

Resolved from an internal audit:

- Session revocation is now enforced for **Bearer-only** requests. The previous check only ran
  when a `refreshToken` cookie was present, so external SSO integrations — which never carry that
  cookie — kept working with revoked sessions
- bcrypt removed from the auth hot path
- Login redirect vulnerability closed; `redirectUrl` restricted to `vyntrise.com` subdomains
- Admin data requests scoped to an explicit platform; `/admin` gated on role
- Invalid or expired JWTs return `401`, not `403`
- Rate limiting added to authentication endpoints (in-memory sliding window,
  `rate-limit.middleware.ts` — per-process, adequate for the current single-instance deployment)
- Cascade delete on `UserPlatformAccess`

### 🐛 Fixes

- Frontend standardized on port 3020 to match the live nginx config
- Corrected production deployment config; added the missing `.dockerignore`
- `router.replace` for post-auth redirects, so Back no longer returns to the login page

---

## [1.0.1] - 2026-07-16

### 📚 Documentation

- In-product SSO integration guide at `/admin/docs`
- Per-platform integration guide, reachable by clicking a platform row

---


## [1.0.0] - 2026-06-16

### 🎉 Major Features

#### Session Revocation System
- **Backend**: Enhanced auth middleware to validate sessions on every request
- **Frontend**: API client detects and handles session revocation
- **Cross-Platform**: Sessions revoked from auth.vyntrise.com immediately affect all connected platforms
- **User Experience**: Clear notifications when sessions are revoked

**Impact**: Users can now revoke sessions and be immediately logged out across all devices and platforms.

#### Platform-Specific Invitations
- **Backend**: Invitations now include `platformId` and `role` fields
- **Frontend**: Admin UI updated with platform selector dropdown
- **Database**: Migration added for invitation role field
- **Logic**: Users can be invited to specific platforms with specific roles

**Impact**: Fine-grained access control - invite users to individual platforms with appropriate roles.

#### Email Service Generalization
- **SMTP Provider**: Added generic SMTP support for any email service
- **Multi-Provider**: Supports console, SMTP (generic), and Gmail
- **Configuration**: Works with SendGrid, Mailgun, AWS SES, custom SMTP
- **Documentation**: Comprehensive EMAIL_SETUP.md guide

**Impact**: Production-ready email system that works with professional email services.

#### Account Management UI Enhancement
- **Navigation**: Added "My Account" link to admin sidebar
- **Back Button**: Account page shows "Back to Admin" for admin users
- **Sign Out**: Added logout button to account page
- **UX**: Seamless navigation between admin and account sections

**Impact**: Users can easily manage their personal settings while accessing admin functions.

---

### 📚 Documentation

#### New Guides
- ✅ `DOCUMENTATION_INDEX.md` - Complete navigation guide for all documentation
- ✅ `SSO_SESSION_VALIDATION_GUIDE.md` - Session revocation implementation guide
- ✅ `EMAIL_SETUP.md` - Email service configuration guide
- ✅ `CHANGELOG.md` - This file

#### Updated Guides
- ✅ `README.md` - Added documentation index link, email config, SSO quick links
- ✅ `SSO_INTEGRATION_GUIDE.md` - Added session revocation security notes
- ✅ `.env.example` - Updated with SMTP configuration options

#### Examples
- ✅ `examples/nextjs-integration/` - Complete Next.js reference implementation
  - `lib/authApi.ts` - Auth API client with session revocation
  - `.env.example` - Environment configuration template
  - `README.md` - Quick start guide

---

### 🔐 Security Enhancements

#### Session Validation
- Auth middleware now checks if sessions exist in database
- Revoked sessions immediately trigger 401 responses
- Cookies cleared on session revocation
- Frontend redirects to login with clear messaging

#### Token Management
- Access tokens: 15 minutes (short-lived)
- Refresh tokens: 7 days (HTTP-only cookies)
- Sessions tracked and can be revoked individually
- Password changes invalidate other sessions

---

### 🗃️ Database Changes

#### New Migrations
- `20260616124142_add_role_to_invitation` - Added `role` field to Invitation model

#### Schema Updates
```prisma
model Invitation {
  id         String   @id @default(uuid())
  email      String
  platformId String
  role       String   @default("USER") // NEW: Role for platform access
  token      String   @unique
  expiresAt  DateTime
  isUsed     Boolean  @default(false)
  createdAt  DateTime @default(now())

  platform Platform @relation(fields: [platformId], references: [id])

  @@unique([email, platformId])
}
```

---

### 🎨 Frontend Changes

#### Admin Panel
- **Invitations Page**: Added platform selector and role column
- **Admin Layout**: Added "My Account" navigation link
- **Platforms Page**: Displays platform IDs for SSO integration

#### Account Page
- **Navigation Bar**: Shows "Back to Admin" and "Sign Out" buttons
- **Session Management**: Enhanced revocation with self-detection
- **Role Detection**: Automatically detects admin status

#### Login Page
- **Messages**: Shows session revoked notification
- **UX**: Clear feedback on why user was redirected

---

### 🔧 Backend Changes

#### Controllers
- **account.controller.ts**: Enhanced session revocation handling
- **admin.controller.ts**: Updated invitation creation with role and platform
- **invite.controller.ts**: Improved registration logic for existing users

#### Middleware
- **auth.middleware.ts**: Added session validation to `authenticateJWT`
  - Now async to support database queries
  - Validates refresh token exists in database
  - Clears cookies on revoked sessions

#### Services
- **email.service.ts**: Added SMTP provider option
- **smtp.provider.ts**: NEW - Generic SMTP implementation

---

### 📦 Dependencies

No new dependencies added. All features use existing packages:
- `jsonwebtoken` - Token validation
- `bcrypt` - Session hash comparison  
- `nodemailer` - Email sending
- `@prisma/client` - Database access

---

### 🧪 Testing Recommendations

#### Session Revocation
1. Login from multiple browsers/devices
2. Go to Account Settings → Active Sessions
3. Revoke a session
4. Verify immediate logout on revoked device

#### Platform-Specific Invitations
1. Create platform in admin panel
2. Generate invitation with specific platform and role
3. Register with invitation link
4. Verify user has correct platform access and role

#### Email Configuration
1. Configure SMTP provider in .env
2. Trigger password reset
3. Verify email delivery
4. Test invitation emails

---

### 🚀 Deployment Notes

#### Environment Variables
Ensure these are set in production:
- `JWT_SECRET` - Must be shared across all platforms
  > **Superseded in 1.3.0** — do not share `JWT_SECRET`. Integrators verify against
  > `/.well-known/jwks.json` instead. See the 1.3.0 entry above.
- `EMAIL_PROVIDER` - Set to `smtp` for production
- `SMTP_HOST`, `SMTP_PORT`, etc. - Configure your email service
- `FRONTEND_URL` - Your auth service frontend URL

#### Database Migrations
Run migrations to update schema:
```bash
cd apps/backend
npx prisma migrate deploy
```

#### Nginx Configuration
No changes required - existing config works with all updates.

---

### 📋 Migration Guide

#### For Platform Developers

**Before**: Tokens worked until expiry even if session was revoked

**After**: Implement session validation in your platform

**Action Required**:
1. Read `SSO_SESSION_VALIDATION_GUIDE.md`
2. Copy `examples/nextjs-integration/lib/authApi.ts` to your project
3. Update your API client to detect session revocation
4. Configure `NEXT_PUBLIC_AUTH_URL` and `JWT_SECRET`
   > **Superseded in 1.3.0** — configure `NEXT_PUBLIC_AUTH_URL` only, and verify tokens against
   > the JWKS endpoint. See the 1.3.0 entry above.
5. Test the flow

#### For Auth Service Administrators

**Before**: Limited email provider options (console or Gmail only)

**After**: Generic SMTP support for any email service

**Action Required**:
1. Read `apps/backend/EMAIL_SETUP.md`
2. Choose email provider (recommend SMTP for production)
3. Update `.env` with SMTP credentials
4. Test email delivery

---

### 🐛 Bug Fixes

- Fixed: Sessions not being invalidated after revocation (now enforced immediately)
- Fixed: Invitation UI not showing platform selection
- Fixed: Email service tied to Gmail only
- Fixed: Account page not accessible from admin panel

---

### ⚡ Performance

- Session validation adds ~1 database query per authenticated request
- Minimal overhead with proper indexing on Session table
- Caching strategies documented for high-traffic scenarios

---

### 🔮 Future Enhancements

Potential improvements for future versions:
- [ ] Session validation caching layer
- [ ] Batch session revocation
- [ ] Session activity logging
- [ ] Email template customization UI
- [ ] Multi-factor authentication (MFA)
- [ ] OAuth provider integration
- [ ] Session device fingerprinting
- [ ] Rate limiting on auth endpoints

---

### 👥 Contributors

- Kiro AI Assistant

---

### 📄 License

Internal Vyntrise Project

---

**Full Documentation**: See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for complete guide navigation.
