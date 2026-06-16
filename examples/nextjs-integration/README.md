# Next.js Integration Example

This directory contains reference implementations for integrating a Next.js application with Vyntrise Auth SSO, including session revocation support.

## Quick Start

1. **Copy the files to your Next.js project:**
   ```bash
   cp lib/authApi.ts your-nextjs-app/lib/
   cp .env.example your-nextjs-app/.env.local
   ```

2. **Update environment variables:**
   - Set `NEXT_PUBLIC_PLATFORM_ID` to your platform UUID from auth.vyntrise.com/admin/platforms
   - Set `JWT_SECRET` to match the auth service (get from auth admin)

3. **Use the API client in your app:**
   ```typescript
   import { authApiFetch, getUserProfile, logout } from '@/lib/authApi';

   // Get user profile
   const profile = await getUserProfile();

   // Make authenticated requests to auth service
   const response = await authApiFetch('/api/account/me');

   // Logout
   await logout();
   ```

## Files Included

- **lib/authApi.ts** - Auth API client with session revocation support
- **.env.example** - Environment variable template

## Features

✅ Automatic token refresh  
✅ Session revocation detection  
✅ User-friendly error handling  
✅ Redirect to login on auth failure  
✅ TypeScript support  

## How It Works

1. **Authentication**: Users are redirected to auth.vyntrise.com for login
2. **Token Storage**: Access token stored in localStorage, refresh token in HTTP-only cookie
3. **API Calls**: authApiFetch() adds Bearer token to requests
4. **Session Validation**: Auth service validates session on every request
5. **Revocation**: If session is revoked, user is immediately redirected to login

## Session Revocation Flow

```
User revokes session → Auth service deletes session record
                                    ↓
        Your app makes authenticated request
                                    ↓
        Auth service returns 401 "Session revoked"
                                    ↓
        authApiFetch detects revocation
                                    ↓
        Clear tokens + redirect to login with message
```

## Additional Resources

- [Full Implementation Guide](../../SSO_SESSION_VALIDATION_GUIDE.md)
- [SSO Integration Guide](../../SSO_INTEGRATION_GUIDE.md)
- [Main README](../../README.md)
