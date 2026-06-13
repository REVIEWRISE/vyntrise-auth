# Vyntrise Auth — Monorepo

Centralized authentication service for the Vyntrise platform. Deployed at `auth.vyntrise.com`.

## Structure

```
vyntrise-auth/
├── apps/
│   ├── backend/    # Express API (port 3010) — JWT auth, Prisma, PostgreSQL
│   └── frontend/   # Next.js UI (port 3002) — Login, Register, Admin Dashboard
└── package.json    # Root npm workspaces config
```

## Getting Started

```bash
# Install all dependencies
npm install

# Run both apps concurrently
npm run dev

# Or run individually
npm run dev:backend
npm run dev:frontend
```

## Environment Variables

Copy `.env.example` to `.env` in each app:

### `apps/backend/.env`
```
DATABASE_URL=postgresql://user:pass@host:port/vyntrise_auth
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
NODE_ENV=production
PORT=3010
```

### `apps/frontend/.env.local`
```
NEXT_PUBLIC_API_URL=https://auth.vyntrise.com/api
```

## SSO Integration

See [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md) for instructions on integrating other Vyntrise apps with the centralized auth system.
