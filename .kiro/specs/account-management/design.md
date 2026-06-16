# Design Document — Account Management

## Overview

This document describes the technical design for the account-management feature. It covers three capability areas: **Forgot/Reset Password** (unauthenticated flows), **Account Settings** (authenticated self-service), and the **EmailService abstraction**. The implementation spans the Express backend (`apps/backend`) and Next.js frontend (`apps/frontend`), following all existing patterns in the codebase.

---

## Architecture

### High-Level Flow

```
Frontend (Next.js)          Backend (Express)              Database (PostgreSQL via Prisma)
─────────────────           ─────────────────              ───────────────────────────────
/forgot-password    →   POST /api/auth/forgot-password  →  PasswordResetToken (upsert)
/reset-password     →   GET  /api/auth/reset-password/:token  (validate)
                    →   POST /api/auth/reset-password   →  User.password (update)
                                                        →  Session (delete all for user)

/account            →   GET  /api/account/me            →  User + UserPlatformAccess
                    →   PATCH /api/account/email         →  User.email (update)
                    →   PATCH /api/account/password      →  User.password (update)
                    →   GET  /api/account/sessions       →  Session (list)
                    →   DELETE /api/account/sessions/:id →  Session (delete one)
                    →   DELETE /api/account             →  User + cascade (delete)
```

### New Backend Route Group

A new route prefix `/api/account` is added to `server.ts`, protected by the existing `authenticateJWT` middleware. The forgot/reset password routes are added under the existing `/api/auth` prefix (no auth required).

---

## Database Schema Changes

Two new Prisma models are required.

### `PasswordResetToken`

```prisma
model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String   @unique          // one active token per user at a time
  token     String   @unique
  expiresAt DateTime
  isUsed    Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- `@unique` on `userId` enforces the one-active-token-per-user constraint from Req 1.6 — upserting on `userId` automatically replaces the previous token.
- `onDelete: Cascade` cleans up tokens when a User is deleted.

### `Session`

```prisma
model Session {
  id             String   @id @default(uuid())
  userId         String
  hashedToken    String   @unique      // bcrypt hash of the refresh token
  userAgent      String?
  createdAt      DateTime @default(now())
  lastUsedAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- Stores a hashed refresh token so the raw token is never persisted.
- `onDelete: Cascade` cleans up sessions when a User is deleted.
- `lastUsedAt` is updated each time `POST /api/auth/refresh` is called.

### Updated `User` model

```prisma
model User {
  // ... existing fields ...
  passwordResetToken PasswordResetToken?
  sessions           Session[]
}
```

### Migration

Run `npx prisma migrate dev --name add-session-and-password-reset-token` after updating the schema.

---

## Backend Design

### File Structure (new files)

```
apps/backend/src/
  services/
    email.service.ts          # EmailService interface + factory
    email-providers/
      console.provider.ts     # Console (dev) implementation
  controllers/
    password-reset.controller.ts
    account.controller.ts
  routes/
    password-reset.routes.ts  # mounted at /api/auth
    account.routes.ts         # mounted at /api/account
```

### EmailService Interface

**`src/services/email.service.ts`**

```typescript
export interface EmailService {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
  sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void>;
}

export function createEmailService(): EmailService {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';
  switch (provider) {
    case 'console':
    default:
      return new ConsoleEmailProvider();
  }
}
```

**`src/services/email-providers/console.provider.ts`**

```typescript
export class ConsoleEmailProvider implements EmailService {
  async sendPasswordResetEmail(to: string, resetLink: string) {
    console.log(`[EMAIL] Password reset for ${to}: ${resetLink}`);
  }
  async sendEmailChangeNotification(oldEmail: string, newEmail: string) {
    console.log(`[EMAIL] Email changed from ${oldEmail} to ${newEmail}`);
  }
}
```

A singleton instance is created once at server startup and shared across controllers.

---

### Password Reset Controller

**`src/controllers/password-reset.controller.ts`**

#### `POST /api/auth/forgot-password`

1. Validate `email` field (syntactically valid, required) — return 400 on failure.
2. Look up `User` by email.
3. If user exists: upsert `PasswordResetToken` with `userId` as key (replaces any previous unused token), set `token = crypto.randomBytes(32).toString('hex')` (64 hex chars), `expiresAt = now + 1h`, `isUsed = false`.
4. Try `emailService.sendPasswordResetEmail(email, resetLink)`. If it throws, log and return 500.
5. Always return 200 `{ message: "If that email is registered, a reset link has been sent" }` — including the email-not-found case.

#### `GET /api/auth/reset-password/:token`

1. Look up `PasswordResetToken` where `token = :token AND isUsed = false AND expiresAt > now`.
2. Found → 200 `{ valid: true }`.
3. Not found / expired → 400 `{ valid: false, message: "Invalid or expired reset token" }`.

#### `POST /api/auth/reset-password`

1. Validate `token` (required) and `password` (required, min 8 chars) — return 400 on failure.
2. Look up `PasswordResetToken` where `token AND isUsed = false AND expiresAt > now`. If not found → 400.
3. Hash new password with `bcrypt.hash(password, 10)`.
4. In a Prisma transaction:
   - Update `User.password`.
   - Mark `PasswordResetToken.isUsed = true`.
   - Delete all `Session` records for that user (forces re-auth).
5. Return 200 `{ message: "Password reset successfully" }`.

---

### Account Controller

**`src/controllers/account.controller.ts`**

All routes require `authenticateJWT` middleware (`req.user.id` is available).

#### `GET /api/account/me`

1. Fetch `User` by `req.user.id`, include `platforms → platform`.
2. Return 200:
```json
{
  "id": "...",
  "email": "...",
  "createdAt": "...",
  "platforms": [
    { "platformId": "...", "platformName": "...", "role": "...", "joinedAt": "..." }
  ]
}
```

#### `PATCH /api/account/email`

1. Validate `newEmail` (valid email, required) and `currentPassword` (required) — 400 on failure.
2. Fetch user, verify `bcrypt.compare(currentPassword, user.password)` — 401 if wrong.
3. Check no other user has `newEmail` — 409 if taken.
4. Update `User.email`.
5. Fire `emailService.sendEmailChangeNotification(oldEmail, newEmail)` (non-blocking, log errors).
6. Return 200 with updated user object.

#### `PATCH /api/account/password`

1. Validate `currentPassword` and `newPassword` (min 8 chars, both required) — 400 on failure.
2. Fetch user, verify `currentPassword` — 401 if wrong.
3. Hash and update `User.password`.
4. Delete all `Session` records for the user except the current session (identified by matching the hashed refresh token from the request cookie, if present — otherwise delete all).
5. Return 200 `{ message: "Password updated successfully" }`.

#### `GET /api/account/sessions`

1. Fetch all `Session` records for `req.user.id`.
2. Return 200 with array of `{ id, createdAt, lastUsedAt, userAgent }` (never expose `hashedToken`).

#### `DELETE /api/account/sessions/:sessionId`

1. Fetch `Session` by `sessionId`.
2. Not found → 404 `{ message: "Session not found" }`.
3. `session.userId !== req.user.id` → 403 `{ message: "Forbidden" }`.
4. Delete session.
5. Return 200 `{ message: "Session revoked" }`.

#### `DELETE /api/account`

1. Validate `password` field (required) — 400 on failure.
2. Fetch user with `platforms` (include `UserPlatformAccess`).
3. Verify password — 401 if wrong.
4. Check if user is the sole `ADMIN` of any platform (count `UserPlatformAccess` where `platformId = p.platformId AND role = 'ADMIN'` for each platform the user admins) — 409 if true.
5. In a transaction: delete all `Session` records, then delete `User` (cascades `UserPlatformAccess`, `PasswordResetToken`).
6. Clear `refreshToken` and `vyntrise_session` cookies.
7. Return 200 `{ message: "Account deleted successfully" }`.

---

### Session Lifecycle Integration

The existing `login` controller must be updated to create a `Session` record after successful authentication, and the existing `refresh` controller must:
1. Look up the `Session` by matching the incoming refresh token hash.
2. Update `Session.lastUsedAt`.
3. Rotate the stored `hashedToken` with the new refresh token hash.

The existing `logout` controller must delete the `Session` record for the current refresh token.

This makes the session store live without changing the JWT cookie mechanism.

---

### Route Registration

**`src/routes/password-reset.routes.ts`** — no auth middleware:
```
POST /forgot-password
GET  /reset-password/:token
POST /reset-password
```
Mounted in `server.ts` as `app.use('/api/auth', passwordResetRoutes)`.

**`src/routes/account.routes.ts`** — all behind `authenticateJWT`:
```
GET    /me
PATCH  /email
PATCH  /password
GET    /sessions
DELETE /sessions/:sessionId
DELETE /
```
Mounted in `server.ts` as `app.use('/api/account', authenticateJWT, accountRoutes)`.

---

## Frontend Design

### File Structure (new files)

```
apps/frontend/
  app/
    forgot-password/
      page.tsx
    reset-password/
      page.tsx
    account/
      page.tsx
  lib/
    auth.ts          # shared fetch helpers / token utilities (if not already present)
```

### Styling & Component Conventions

All new pages follow the dark zinc theme established in `login/page.tsx`:
- Background: `bg-zinc-950`, cards: `bg-zinc-900/50 backdrop-blur-xl border-zinc-800`
- Labels: `text-zinc-200`, inputs: `bg-zinc-950/50 border-zinc-800 text-zinc-100`
- Primary button: `bg-zinc-50 text-zinc-950 hover:bg-zinc-200`
- Destructive actions: `bg-red-600 hover:bg-red-700 text-white`
- Error banners: `bg-red-500/10 border-red-500/20 text-red-400`
- Success banners: `bg-green-500/10 border-green-500/20 text-green-400`
- All pages are `'use client'` components.

---

### `/forgot-password` Page

**Behavior:**
- Single email input form.
- On any response (success or error), display: `"If that email is registered, a reset link has been sent"` — never expose the actual response body to the user.
- Link back to `/login`.

---

### `/reset-password` Page

**Behavior:**
- On mount, reads `?token=` from the URL query params.
- Calls `GET /api/auth/reset-password/:token`.
- If `{ valid: false }`: shows error message `"This reset link is invalid or has expired. Please request a new one."` with a link to `/forgot-password`. Password form is not rendered.
- If `{ valid: true }`: renders a form with `newPassword` and `confirmNewPassword` fields.
- On submit, calls `POST /api/auth/reset-password` with `{ token, password }`. On success, redirects to `/login` with a `?message=password-reset` query param (the login page can display a success notice).
- Uses `Suspense` wrapper (same pattern as login page) to handle `useSearchParams`.

---

### `/login` Page Update

Two small changes:
1. Add a `"Forgot your password?"` link below the password field, navigating to `/forgot-password`.
2. On mount, if `?message=password-reset` is present in the URL, show a green success banner: `"Your password has been reset. Please sign in."`.

---

### `/account` Page

**Auth guard:** On mount, check for `accessToken` in localStorage. If absent, redirect to `/login?redirectUrl=/account`.

**Layout:** Single page with a top header (email + joined date), then five card sections:

| Section | API | Key actions |
|---|---|---|
| **Profile** | `GET /api/account/me` on mount | Display email, joined date |
| **Platform Memberships** | same `GET /api/account/me` response | List platform name + role badge |
| **Change Email** | `PATCH /api/account/email` | Fields: newEmail, currentPassword |
| **Change Password** | `PATCH /api/account/password` | Fields: currentPassword, newPassword, confirmNewPassword |
| **Active Sessions** | `GET /api/account/sessions` | List sessions with Revoke button each |
| **Danger Zone** | `DELETE /api/account` | Password-confirmation modal before calling delete |

**UX rules:**
- Each form section manages its own local state and loading/error/success flags.
- Success and error messages appear inline within each section — no full-page reload.
- The "Delete Account" button opens an inline confirmation that requires typing the password, then calls the API. On success, clears localStorage and redirects to `/login`.
- The `Authorization: Bearer <token>` header is sent on all authenticated requests using the token from localStorage.

---

## Security Considerations

- **Email enumeration prevention**: `POST /api/auth/forgot-password` always returns 200 with the same message regardless of whether the email exists.
- **Token entropy**: `crypto.randomBytes(32).toString('hex')` produces a 64-character hex string with 256 bits of entropy.
- **Single-use tokens**: `isUsed` flag prevents replay; `@unique` on `PasswordResetToken.userId` prevents accumulation of unused tokens.
- **Session invalidation on sensitive operations**: Password reset and password change both delete all (other) sessions to enforce re-authentication on other devices.
- **Hashed refresh tokens**: Raw refresh token JWTs are never stored; only a bcrypt hash is persisted in `Session.hashedToken`.
- **Sole-admin guard**: Account deletion blocked if user is the only admin of any platform, preventing orphaned platforms.
- **Cookie cleanup on delete**: Both `refreshToken` and `vyntrise_session` cookies are cleared server-side on account deletion.

---

## Error Response Shapes

All error responses use the existing shape:
```json
{ "message": "Human-readable error string" }
```

Validation errors use the same shape with a descriptive message pointing at the failing field.

---

## Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `EMAIL_PROVIDER` | Selects the email implementation (`console`) | `console` |
| `FRONTEND_URL` | Base URL used to build reset links (e.g. `http://localhost:3000`) | Required |

`FRONTEND_URL` is used by the backend to construct the reset link: `${FRONTEND_URL}/reset-password?token=${token}`.
