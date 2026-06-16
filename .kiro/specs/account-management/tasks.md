# Implementation Tasks

## Task List

- [x] 1. Database schema — add PasswordResetToken and Session models
  - Add `PasswordResetToken` model to `prisma/schema.prisma` with fields: `id`, `userId` (unique), `token` (unique), `expiresAt`, `isUsed`, `createdAt`, and a cascade relation to `User`
  - Add `Session` model to `prisma/schema.prisma` with fields: `id`, `userId`, `hashedToken` (unique), `userAgent`, `createdAt`, `lastUsedAt`, and a cascade relation to `User`
  - Add `passwordResetToken` and `sessions` back-relations to the `User` model
  - Run `npx prisma migrate dev --name add-session-and-password-reset-token` to apply the migration and regenerate the Prisma client
  - **Requirements:** 1.1, 2.6, 7.5

- [x] 2. EmailService interface and console provider
  - Create `apps/backend/src/services/email.service.ts` exporting the `EmailService` interface with `sendPasswordResetEmail(to, resetLink): Promise<void>` and `sendEmailChangeNotification(oldEmail, newEmail): Promise<void>`
  - Create `apps/backend/src/services/email-providers/console.provider.ts` implementing `EmailService` by logging to console
  - Export a `createEmailService()` factory function that reads `process.env.EMAIL_PROVIDER` (default `'console'`) and returns the appropriate provider instance
  - Instantiate a singleton `emailService` in `server.ts` and make it available to controllers
  - **Requirements:** 9.1, 9.2, 9.3, 9.4

- [x] 3. Session management — update login, refresh, and logout
  - Update `login` in `auth.controller.ts`: after generating tokens, create a `Session` record with `userId`, `hashedToken = bcrypt.hash(refreshToken, 10)`, and `userAgent` from `req.headers['user-agent']`
  - Update `refresh` in `auth.controller.ts`: look up `Session` by matching the incoming refresh token hash, update `lastUsedAt` and rotate `hashedToken` to the new refresh token hash; return 403 if no matching session found
  - Update `logout` in `auth.controller.ts`: delete the `Session` record for the current refresh token hash
  - **Requirements:** 7.5, 2.6, 4.6

- [x] 4. Password reset controller and routes
  - Create `apps/backend/src/controllers/password-reset.controller.ts` with three exported handlers: `forgotPassword`, `validateResetToken`, `resetPassword`
  - `forgotPassword`: validate email format (400 if invalid); look up user; if found, upsert `PasswordResetToken` (replace existing); try `emailService.sendPasswordResetEmail`; always return 200 with the anti-enumeration message; return 500 only if email service throws
  - `validateResetToken`: look up token where `isUsed=false AND expiresAt > now`; return `{ valid: true }` (200) or `{ valid: false, message: ... }` (400)
  - `resetPassword`: validate `token` and `password` (min 8 chars, 400 on failure); look up valid token; in a transaction update `User.password`, set `PasswordResetToken.isUsed=true`, delete all `Session` records for user; return 200
  - Create `apps/backend/src/routes/password-reset.routes.ts` wiring the three handlers; mount in `server.ts` under `/api/auth`
  - **Requirements:** 1.1–1.7, 2.1–2.7, 3.1–3.2

- [x] 5. Account controller and routes
  - Create `apps/backend/src/controllers/account.controller.ts` with handlers: `getMe`, `changeEmail`, `changePassword`, `getSessions`, `revokeSession`, `deleteAccount`
  - `getMe`: fetch user with platforms+platform; return profile + memberships array (200)
  - `changeEmail`: validate inputs; verify current password (401); check email uniqueness (409); update email; fire change notification email (non-blocking); return updated user (200)
  - `changePassword`: validate inputs (min 8 chars); verify current password (401); hash and update; delete other sessions; return 200
  - `getSessions`: return `[{ id, createdAt, lastUsedAt, userAgent }]` for current user (never expose hashedToken)
  - `revokeSession`: fetch session; 404 if not found; 403 if not owned by requester; delete; return 200
  - `deleteAccount`: validate password; verify it; check sole-admin guard (409); in transaction delete sessions then user; clear cookies; return 200
  - Create `apps/backend/src/routes/account.routes.ts`; mount in `server.ts` as `app.use('/api/account', authenticateJWT, accountRoutes)`
  - **Requirements:** 4.1–4.6, 5.1–5.6, 6.1–6.3, 7.1–7.5, 8.1–8.5

- [x] 6. Frontend — Forgot Password page
  - Create `apps/frontend/app/forgot-password/page.tsx` as a `'use client'` component
  - Single card with email input; on submit call `POST /api/auth/forgot-password`; on any response (success or error) display: `"If that email is registered, a reset link has been sent"` — never show the response body
  - Include a "Back to sign in" link pointing to `/login`
  - Match the dark zinc card styling from `login/page.tsx`
  - **Requirements:** 10.1, 10.2

- [x] 7. Frontend — Reset Password page
  - Create `apps/frontend/app/reset-password/page.tsx` as a `'use client'` component wrapped in `Suspense` (same pattern as login)
  - On mount, read `?token=` from `useSearchParams`; call `GET /api/auth/reset-password/:token`
  - If `{ valid: false }`: render error message `"This reset link is invalid or has expired. Please request a new one."` with a link to `/forgot-password`; do not render password form
  - If `{ valid: true }`: render form with `newPassword` and `confirmNewPassword` fields; on submit call `POST /api/auth/reset-password`; on success redirect to `/login?message=password-reset`
  - **Requirements:** 10.3, 10.4, 10.5

- [x] 8. Frontend — Update Login page
  - Add a `"Forgot your password?"` link below the password field in `apps/frontend/app/login/page.tsx` navigating to `/forgot-password`
  - On mount, if `useSearchParams` contains `message=password-reset`, show a green success banner: `"Your password has been reset. Please sign in."`
  - **Requirements:** 10.6

- [x] 9. Frontend — Account Settings page
  - Create `apps/frontend/app/account/page.tsx` as a `'use client'` component
  - Auth guard on mount: if no `accessToken` in localStorage, redirect to `/login`
  - Fetch `GET /api/account/me` and `GET /api/account/sessions` on mount using `Authorization: Bearer <token>` header
  - Render six sections as separate cards, each with independent state and inline feedback:
    - **Profile**: email + `createdAt` date
    - **Platform Memberships**: list of platform name + role (using `Badge` component)
    - **Change Email**: fields `newEmail`, `currentPassword` → `PATCH /api/account/email`
    - **Change Password**: fields `currentPassword`, `newPassword`, `confirmNewPassword` (validate match client-side) → `PATCH /api/account/password`
    - **Active Sessions**: list with `createdAt`, `lastUsedAt`, `userAgent`, and "Revoke" button per row → `DELETE /api/account/sessions/:id`
    - **Danger Zone**: "Delete Account" button that reveals a password confirmation input → `DELETE /api/account`; on success clear localStorage and redirect to `/login`
  - On delete account success, clear `accessToken` from localStorage before redirecting
  - **Requirements:** 11.1–11.8
