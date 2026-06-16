# Requirements Document

## Introduction

This feature adds self-service account management capabilities to the Vyntrise auth system. Users enter the system only via admin-issued email invitations, so there is no public self-registration. The feature covers three areas:

1. **Forgot Password** — an unauthenticated user requests a password-reset link sent to their registered email address.
2. **Reset Password** — the user follows a secure, time-limited token link to set a new password.
3. **Account Settings** — an authenticated user can change their email address, change their password, view the platforms they belong to, view active sessions, and delete their own account.

Email delivery is treated as an integration point (an `EmailService` interface). No specific email provider is mandated; the initial implementation may log the link to the console/stub, but the interface must be defined so a real provider can be wired in later.

---

## Glossary

- **User**: A person who has registered via an invitation and holds credentials in the system.
- **Admin**: A User whose `UserPlatformAccess.role` is `ADMIN` for at least one Platform.
- **Platform**: A tenant within the multi-tenant system, identified by a unique `platformId`.
- **PasswordResetToken**: A cryptographically random, single-use token stored server-side, used to authorize a password reset.
- **EmailService**: The abstraction layer responsible for dispatching transactional emails. The concrete provider is injected at runtime.
- **AccountSettings**: The self-service page where an authenticated User manages their profile and security preferences.
- **Session**: An active refresh-token credential that grants a User continued access.
- **Access Token**: A short-lived JWT (15 minutes) used to authenticate API requests.
- **Refresh Token**: A long-lived JWT (7 days) stored in an HTTP-only cookie, used to obtain new Access Tokens.

---

## Requirements

### Requirement 1: Request Password Reset

**User Story:** As a User who has forgotten their password, I want to request a password-reset link, so that I can regain access to my account without contacting an Admin.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/forgot-password` request is received with a valid email address, THE Password_Reset_Service SHALL create a `PasswordResetToken` record with a cryptographically random 64-character hex token and an expiry of 1 hour from creation time.
2. WHEN a `POST /api/auth/forgot-password` request is received, THE Password_Reset_Service SHALL instruct the `EmailService` to send a password-reset email containing the reset link to the provided address.
3. WHEN a `POST /api/auth/forgot-password` request is received with an email address that does not correspond to any User, THE Password_Reset_Service SHALL return an HTTP 200 response with the message "If that email is registered, a reset link has been sent" (preventing email enumeration).
4. WHEN a `POST /api/auth/forgot-password` request is received with an email address that corresponds to an existing User, THE Password_Reset_Service SHALL also return an HTTP 200 response with the message "If that email is registered, a reset link has been sent".
5. IF the `EmailService` fails to dispatch the reset email, THEN THE Password_Reset_Service SHALL log the failure and return an HTTP 500 response with the message "Failed to send reset email".
6. WHEN a `PasswordResetToken` record already exists and is unused for a given User, THE Password_Reset_Service SHALL invalidate the previous token before creating a new one.
7. THE Password_Reset_Service SHALL accept only syntactically valid email addresses; IF the email field is missing or malformed, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with a descriptive validation error.

---

### Requirement 2: Reset Password via Token

**User Story:** As a User who has received a password-reset link, I want to set a new password using the token in that link, so that I can log in again.

#### Acceptance Criteria

1. WHEN a `POST /api/auth/reset-password` request is received with a valid, unexpired `PasswordResetToken` and a new password, THE Password_Reset_Service SHALL hash the new password and update the User's `password` field.
2. WHEN a `POST /api/auth/reset-password` request is received with a valid token and a successful password update, THE Password_Reset_Service SHALL mark the `PasswordResetToken` as used and return an HTTP 200 response.
3. IF a `POST /api/auth/reset-password` request is received with a token that does not exist or has already been used, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with the message "Invalid or expired reset token".
4. IF a `POST /api/auth/reset-password` request is received with a token whose `expiresAt` timestamp is in the past, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with the message "Invalid or expired reset token".
5. THE Password_Reset_Service SHALL require the new password to be at least 8 characters long; IF the password is shorter, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with a descriptive validation error.
6. WHEN a password reset completes successfully, THE Password_Reset_Service SHALL invalidate all existing Refresh Tokens for that User by clearing active sessions, forcing re-authentication.
7. IF the `token` field is missing from a `POST /api/auth/reset-password` request, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with a descriptive validation error.

---

### Requirement 3: Validate Reset Token (Frontend Pre-check)

**User Story:** As a User navigating to a password-reset link, I want the page to verify the token is still valid before rendering the form, so that I receive immediate feedback if the link has expired.

#### Acceptance Criteria

1. WHEN a `GET /api/auth/reset-password/:token` request is received with a valid, unexpired token, THE Password_Reset_Service SHALL return an HTTP 200 response with the payload `{ valid: true }`.
2. IF a `GET /api/auth/reset-password/:token` request is received with an invalid or expired token, THEN THE Password_Reset_Service SHALL return an HTTP 400 response with the payload `{ valid: false, message: "Invalid or expired reset token" }`.

---

### Requirement 4: Change Password (Authenticated)

**User Story:** As an authenticated User, I want to change my password from the Account Settings page, so that I can maintain the security of my account.

#### Acceptance Criteria

1. WHEN a `PATCH /api/account/password` request is received from an authenticated User with the correct `currentPassword` and a valid `newPassword`, THE Account_Service SHALL hash the new password and update the User's `password` field.
2. IF a `PATCH /api/account/password` request contains a `currentPassword` that does not match the User's stored hash, THEN THE Account_Service SHALL return an HTTP 401 response with the message "Current password is incorrect".
3. THE Account_Service SHALL require `newPassword` to be at least 8 characters long; IF it is shorter, THEN THE Account_Service SHALL return an HTTP 400 response with a descriptive validation error.
4. IF `currentPassword` or `newPassword` is missing from a `PATCH /api/account/password` request, THEN THE Account_Service SHALL return an HTTP 400 response with a descriptive validation error.
5. WHEN a password change completes successfully, THE Account_Service SHALL return an HTTP 200 response with the message "Password updated successfully".
6. WHEN a password change completes successfully, THE Account_Service SHALL invalidate all existing Refresh Tokens for that User (except the current session) by clearing stored sessions.

---

### Requirement 5: Change Email Address (Authenticated)

**User Story:** As an authenticated User, I want to update the email address on my account, so that my login credentials stay current with my real email.

#### Acceptance Criteria

1. WHEN a `PATCH /api/account/email` request is received from an authenticated User with a valid `newEmail` and the correct `currentPassword`, THE Account_Service SHALL update the User's `email` field to the new address.
2. IF the `newEmail` in a `PATCH /api/account/email` request is already registered to another User, THEN THE Account_Service SHALL return an HTTP 409 response with the message "Email address is already in use".
3. IF the `currentPassword` in a `PATCH /api/account/email` request does not match the User's stored hash, THEN THE Account_Service SHALL return an HTTP 401 response with the message "Current password is incorrect".
4. THE Account_Service SHALL accept only syntactically valid email addresses for `newEmail`; IF the value is missing or malformed, THEN THE Account_Service SHALL return an HTTP 400 response with a descriptive validation error.
5. WHEN an email change completes successfully, THE Account_Service SHALL return an HTTP 200 response with the updated user object containing the new email.
6. WHERE the `EmailService` is configured, THE Account_Service SHALL instruct the `EmailService` to send a confirmation notification to both the old and new email addresses after a successful email change.

---

### Requirement 6: View Account Profile and Platform Memberships

**User Story:** As an authenticated User, I want to view my profile details and the platforms I belong to, so that I have a clear picture of my account.

#### Acceptance Criteria

1. WHEN a `GET /api/account/me` request is received from an authenticated User, THE Account_Service SHALL return the User's `id`, `email`, `createdAt`, and an array of platform memberships each containing `platformId`, `platformName`, `role`, and `joinedAt`.
2. THE Account_Service SHALL return only the platform memberships that belong to the requesting User.
3. WHEN a `GET /api/account/me` request is received, THE Account_Service SHALL return an HTTP 200 response.

---

### Requirement 7: View and Revoke Active Sessions

**User Story:** As an authenticated User, I want to see my active sessions and revoke individual ones, so that I can remove access from devices I no longer use.

#### Acceptance Criteria

1. WHEN a `GET /api/account/sessions` request is received from an authenticated User, THE Account_Service SHALL return a list of active sessions, each containing a session `id`, `createdAt`, `lastUsedAt`, and `userAgent`.
2. WHEN a `DELETE /api/account/sessions/:sessionId` request is received from an authenticated User for a session that belongs to that User, THE Account_Service SHALL invalidate that session and return an HTTP 200 response.
3. IF a `DELETE /api/account/sessions/:sessionId` request references a session that does not belong to the requesting User, THEN THE Account_Service SHALL return an HTTP 403 response with the message "Forbidden".
4. IF a `DELETE /api/account/sessions/:sessionId` request references a session that does not exist, THEN THE Account_Service SHALL return an HTTP 404 response with the message "Session not found".
5. THE Session_Store SHALL persist session records in the database, linking each session to a User, storing the hashed Refresh Token value, `createdAt`, `lastUsedAt`, and `userAgent`.

---

### Requirement 8: Delete Account

**User Story:** As an authenticated User, I want to permanently delete my account, so that all my personal data is removed from the system.

#### Acceptance Criteria

1. WHEN a `DELETE /api/account` request is received from an authenticated User with the correct `password` confirmation, THE Account_Service SHALL delete the User's record and all associated `UserPlatformAccess` records.
2. IF the `password` provided in a `DELETE /api/account` request does not match the User's stored hash, THEN THE Account_Service SHALL return an HTTP 401 response with the message "Password is incorrect".
3. WHEN an account deletion completes successfully, THE Account_Service SHALL clear the `refreshToken` and `vyntrise_session` cookies and return an HTTP 200 response with the message "Account deleted successfully".
4. WHEN an account deletion completes successfully, THE Account_Service SHALL invalidate all active sessions for that User before deleting the User record.
5. IF a User is the sole ADMIN of one or more Platforms, THEN THE Account_Service SHALL return an HTTP 409 response with the message "Transfer or remove admin role before deleting your account" and SHALL NOT delete the account.

---

### Requirement 9: Email Service Interface

**User Story:** As a developer, I want a defined `EmailService` interface for transactional emails, so that a real provider can be integrated later without changing callers.

#### Acceptance Criteria

1. THE EmailService_Interface SHALL expose a `sendPasswordResetEmail(to: string, resetLink: string): Promise<void>` method.
2. THE EmailService_Interface SHALL expose a `sendEmailChangeNotification(oldEmail: string, newEmail: string): Promise<void>` method.
3. THE Console_Email_Provider SHALL implement the `EmailService_Interface` by logging the email recipient, subject, and relevant link to the server console, enabling development and testing without a live email provider.
4. WHEN the application starts, THE Server SHALL load the concrete `EmailService` implementation from an environment variable `EMAIL_PROVIDER` (default: `console`).

---

### Requirement 10: Frontend — Forgot / Reset Password Pages

**User Story:** As a User who has forgotten their password, I want dedicated frontend pages for requesting and completing a password reset, so that I can complete the flow without leaving the application.

#### Acceptance Criteria

1. THE Frontend SHALL provide a `/forgot-password` page containing an email input form that submits to `POST /api/auth/forgot-password`.
2. WHEN the forgot-password form submission returns any HTTP response, THE Frontend SHALL display the message "If that email is registered, a reset link has been sent" regardless of the response body, to avoid leaking information.
3. THE Frontend SHALL provide a `/reset-password` page that reads the `token` query parameter, calls `GET /api/auth/reset-password/:token` on mount, and renders a new-password form only when the token is valid.
4. WHEN the token validation call returns `{ valid: false }`, THE Frontend SHALL display the message "This reset link is invalid or has expired. Please request a new one." and SHALL NOT render the password-input form.
5. WHEN the reset-password form is submitted successfully, THE Frontend SHALL redirect the User to `/login` with a success notification.
6. THE Frontend SHALL add a "Forgot your password?" link on the `/login` page that navigates to `/forgot-password`.

---

### Requirement 11: Frontend — Account Settings Page

**User Story:** As an authenticated User, I want a single Account Settings page that consolidates all self-service account operations, so that I can manage my account without navigating to multiple locations.

#### Acceptance Criteria

1. THE Frontend SHALL provide an `/account` page accessible only to authenticated Users; WHEN an unauthenticated User attempts to access `/account`, THE Frontend SHALL redirect them to `/login`.
2. THE Account_Settings_Page SHALL display the User's current email address and `createdAt` date.
3. THE Account_Settings_Page SHALL contain a "Change Email" section with fields for `newEmail` and `currentPassword`, wired to `PATCH /api/account/email`.
4. THE Account_Settings_Page SHALL contain a "Change Password" section with fields for `currentPassword`, `newPassword`, and `confirmNewPassword`, wired to `PATCH /api/account/password`.
5. THE Account_Settings_Page SHALL contain a "Platform Memberships" section listing each platform name and the User's role on that platform, sourced from `GET /api/account/me`.
6. THE Account_Settings_Page SHALL contain an "Active Sessions" section listing sessions returned by `GET /api/account/sessions`, with a "Revoke" button for each session.
7. THE Account_Settings_Page SHALL contain a "Danger Zone" section with a "Delete Account" action that requires the User to confirm their password before calling `DELETE /api/account`.
8. WHEN any form on the Account Settings page is submitted, THE Account_Settings_Page SHALL display success or error feedback inline without a full-page reload.
