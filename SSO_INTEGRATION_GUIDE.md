# SSO Integration Guide

This guide explains how to integrate an external Vyntrise product (e.g. `vyntrise-sms`) with the centralized `vyntrise-auth` service.

---

## Overview

`vyntrise-auth` is the single identity provider for all Vyntrise products. External apps never handle passwords — they redirect unauthenticated users to `auth.vyntrise.com`, which authenticates them and sends a signed JWT back to the app.

```
User visits             Redirect to              User authenticated
vyntrise-sms.com   →   auth.vyntrise.com/login   →   vyntrise-sms.com/callback
(not logged in)        with platformId + callback     with ?token=<jwt>
```

---

## Step 1 — Create a Platform

1. Log in to the admin panel at `https://auth.vyntrise.com/admin`
2. Go to **Platforms**
3. Click **Create Platform** and enter a name (e.g. "Vyntrise SMS")
4. After creation, **copy the Platform ID** (UUID) from the table — you'll need it in Step 3

---

## Step 2 — Invite Users

Users access the system only via admin-issued invitations. There is no public registration.

**Invitations are platform-specific** — each invitation grants access to a specific platform only.

1. Go to **Invitations** in the admin panel
2. Enter the user's email
3. **Select the platform** you want to invite them to (e.g., "Vyntrise SMS")
4. Select their role (`USER` or `ADMIN`)
5. Click **Generate Link** — a registration link is displayed and emailed to the user
6. The user clicks the link, sets a password, and is granted access to the specified platform

**Note:** If a user needs access to multiple platforms, they must be invited separately to each platform. The same email address can be invited to different platforms with different roles.

---

## Step 3 — Configure the Redirect

In your external app, redirect unauthenticated users to:

```
https://auth.vyntrise.com/login?platformId={PLATFORM_ID}&redirectUrl={CALLBACK_URL}
```

| Parameter | Value |
|---|---|
| `platformId` | The UUID copied from the Platforms page |
| `redirectUrl` | The full URL in your app that handles the token callback |

**Example:**
```
https://auth.vyntrise.com/login
  ?platformId=e4ddbaa4-ac57-4485-b634-667498e8d408
  &redirectUrl=https://sms.vyntrise.com/auth/callback
```

The auth system verifies that the user has access to that specific platform before issuing a token. Users without access are rejected at login.

---

## Step 4 — Handle the Callback

After successful login, the user is redirected back to your `redirectUrl` with the access token appended as a query param:

```
https://sms.vyntrise.com/auth/callback?token=eyJhbGci...
```

In your callback handler:

```javascript
// Example: Next.js route handler
const token = new URL(window.location.href).searchParams.get('token');
localStorage.setItem('accessToken', token);
// Redirect to the app's main page
```

---

## Step 5 — Use the Token

Include the token in all API calls back to `vyntrise-auth`:

```http
Authorization: Bearer <accessToken>
```

**Example — get the user's profile:**
```
GET https://auth.vyntrise.com/api/account/me
Authorization: Bearer eyJhbGci...
```

Response:
```json
{
  "id": "34d9497c-cbcf-489b-8b8c-7f7400e85005",
  "email": "user@example.com",
  "createdAt": "2026-06-15T12:00:00.000Z",
  "platforms": [
    {
      "platformId": "e4ddbaa4-ac57-4485-b634-667498e8d408",
      "platformName": "Vyntrise SMS",
      "role": "USER",
      "joinedAt": "2026-06-15T12:00:00.000Z"
    }
  ]
}
```

---

## Step 6 — Token Refresh

Access tokens expire in **15 minutes**. Use the refresh token (stored in the `refreshToken` HTTP-only cookie) to get a new one:

```
POST https://auth.vyntrise.com/api/auth/refresh
```

The refresh token is sent automatically via the cookie. On success you receive a new `accessToken` in the response body and new cookies are set.

If your app uses `fetch` with `credentials: 'include'`, cookies are sent automatically for same-origin requests. For cross-origin requests, ensure:
1. Your app is on a subdomain of `vyntrise.com` (cookies are set for `.vyntrise.com`)
2. Requests include `credentials: 'include'`
3. The auth server's `ALLOWED_ORIGINS` env var includes your app's origin

---

## JWT Payload

The access token payload contains:

```json
{
  "id": "<user-uuid>",
  "email": "user@example.com",
  "iat": 1234567890,
  "exp": 1234568790
}
```

Verify tokens using the shared `JWT_SECRET`. Contact the Vyntrise platform team for the production secret value.

---

## Security Notes

- Never store the raw `refreshToken` — it's HTTP-only and not accessible via JavaScript
- The `platformId` check at login ensures users can only access platforms they've been invited to
- Access tokens are short-lived (15 min) to limit exposure if leaked
- All session activity is tracked in the `Session` table — admins can see and revoke sessions from the Account Settings page

---

## Quick Reference

| URL | Purpose |
|---|---|
| `https://auth.vyntrise.com/login?platformId=X&redirectUrl=Y` | SSO login entry point |
| `https://auth.vyntrise.com/api/auth/refresh` | Refresh access token |
| `https://auth.vyntrise.com/api/auth/logout` | Logout + clear session |
| `https://auth.vyntrise.com/api/account/me` | Get user profile + platform memberships |
| `https://auth.vyntrise.com/admin/platforms` | Manage platforms + copy Platform IDs |
