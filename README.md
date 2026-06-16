# Vyntrise Auth — Monorepo

Centralized authentication service for the Vyntrise platform ecosystem. Deployed at `auth.vyntrise.com`.

Vyntrise Auth acts as a **single sign-on (SSO) provider** for all Vyntrise products (vyntrise-sms, vyntrise-crm, etc.). Each external product registers itself as a **Platform** and redirects users here to authenticate. After login, users are sent back to the product with a short-lived JWT.

---

## Repository Structure

```
vyntrise-auth-mono/
├── apps/
│   ├── backend/          # Express API (port 3021)
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── auth.controller.ts        # login, logout, refresh
│   │   │   │   ├── password-reset.controller.ts
│   │   │   │   ├── account.controller.ts     # self-service account settings
│   │   │   │   └── admin.controller.ts       # admin panel, platforms, invites
│   │   │   ├── routes/
│   │   │   ├── middlewares/
│   │   │   │   ├── auth.middleware.ts         # authenticateJWT
│   │   │   │   └── admin.middleware.ts        # requireAdmin
│   │   │   ├── services/
│   │   │   │   ├── email.service.ts           # EmailService interface + factory
│   │   │   │   └── email-providers/
│   │   │   │       ├── console.provider.ts    # dev: logs to stdout
│   │   │   │       └── gmail.provider.ts      # production: Gmail via nodemailer
│   │   │   └── server.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   └── frontend/         # Next.js 16 UI (port 3001)
│       └── app/
│           ├── login/            # SSO login page
│           ├── register/         # Invite-based registration
│           ├── forgot-password/
│           ├── reset-password/
│           ├── account/          # Self-service account settings
│           └── admin/            # Admin dashboard
│               ├── page.tsx      # Stats
│               ├── users/
│               ├── invites/
│               └── platforms/    # Platform management + SSO setup
├── nginx/
│   ├── auth.vyntrise.com.conf
│   └── auth.vyntrise.com.http-only.conf
└── package.json
```

---

## Getting Started

```bash
# Install all dependencies (uses pnpm workspaces)
pnpm install

# Run both apps
pnpm dev
```

Backend runs on `http://localhost:3021`, frontend on `http://localhost:3001`.

---

## Environment Variables

### `apps/backend/.env`

```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/vyntrise_auth"

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Server
PORT=3021
NODE_ENV=development

# Frontend (used to build email links)
FRONTEND_URL=http://localhost:3001

# Email
# Set to "console" to log emails to stdout (dev default)
# Set to "gmail" to send via Gmail
EMAIL_PROVIDER=console
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
```

> Gmail App Passwords require 2FA to be enabled on the account. Generate one at https://myaccount.google.com/apppasswords

---

## Authentication Flow

### Token Types

| Token | TTL | Storage | Purpose |
|---|---|---|---|
| Access Token (JWT) | 15 min | `localStorage` + `vyntrise_session` cookie | API authentication |
| Refresh Token (JWT) | 7 days | `refreshToken` HTTP-only cookie | Obtain new access tokens |

Refresh tokens are stored **hashed** in the `Session` table — the raw token is never persisted.

### Session Management

Every login creates a `Session` record. `POST /api/auth/refresh` rotates the stored hash. Logout deletes the session. Password reset and password change invalidate all sessions (forcing re-auth on other devices).

---

## API Reference

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | Login with email + password |
| POST | `/logout` | — | Clear cookies + delete session |
| POST | `/refresh` | — | Rotate access token using refresh cookie |
| POST | `/forgot-password` | — | Send password reset email |
| GET | `/reset-password/:token` | — | Validate reset token |
| POST | `/reset-password` | — | Reset password using token |

### Account (`/api/account`) — requires JWT

| Method | Path | Description |
|---|---|---|
| GET | `/me` | Profile + platform memberships |
| PATCH | `/email` | Change email address |
| PATCH | `/password` | Change password |
| GET | `/sessions` | List active sessions |
| DELETE | `/sessions/:id` | Revoke a session |
| DELETE | `/` | Delete account |

### Admin (`/api/admin`) — requires JWT + platform admin role

| Method | Path | Description |
|---|---|---|
| GET | `/stats` | Dashboard stats (users, invites) |
| GET | `/users` | List platform users |
| GET | `/invites` | List platform invitations |
| POST | `/invites` | Create an invitation |
| GET | `/platforms` | List all platforms |
| POST | `/platforms` | Create a new platform |

### Invite (`/api/invite`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register via invitation token |

---

## SSO Integration

See [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md) for step-by-step instructions on integrating an external Vyntrise app with this auth service.

---

## Database Schema

```
User ──────────────── UserPlatformAccess ──── Platform
  │                                              │
  ├── PasswordResetToken                         ├── Invitation
  └── Session
```

- **Platform** — a tenant/product (e.g. "Vyntrise SMS")
- **UserPlatformAccess** — links users to platforms with a role (`ADMIN` or `USER`)
- **Invitation** — scoped to a platform; used for invite-only registration
- **Session** — tracks active refresh token hashes per user
- **PasswordResetToken** — single-use, 1-hour expiry, one per user at a time

---

## Deployment

The nginx config at `nginx/auth.vyntrise.com.conf` proxies:
- `/` → Next.js frontend (port 3002 in production)
- `/api/` → Express backend (port 3021)

For Docker deployment, both services are referenced as `frontend` and `backend` hostnames inside the nginx config.
