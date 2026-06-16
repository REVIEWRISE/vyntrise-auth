# SSO Session Validation Implementation Guide

This guide explains how to implement session validation in external platforms that use Vyntrise Auth for SSO. This ensures that when a session is revoked in the auth system, the user is immediately logged out from all connected platforms.

---

## Overview

The Vyntrise Auth system now validates sessions on every authenticated request. External platforms need to:

1. Handle 401 errors with "session revoked" messages
2. Clear local tokens when sessions are revoked
3. Redirect users to re-authenticate

---

## Implementation Steps

### Step 1: Update API Client/Fetch Wrapper

Add session revocation detection to your API client that communicates with `auth.vyntrise.com`.

#### Example: Next.js/React Application

```typescript
// lib/authApi.ts

/**
 * Authenticated fetch wrapper for auth.vyntrise.com endpoints
 */
export async function authApiFetch(
  endpoint: string, 
  init: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('accessToken');
  const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.vyntrise.com';

  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${authBaseUrl}${endpoint}`;
  let res = await fetch(url, { 
    ...init, 
    headers,
    credentials: 'include' // Important: Send cookies for session validation
  });

  // Handle authentication errors
  if (res.status === 401 || res.status === 403) {
    const errorData = await res.clone().json().catch(() => ({}));
    
    // Check if session was revoked
    if (errorData.message?.toLowerCase().includes('revoked')) {
      handleSessionRevoked();
      return res;
    }

    // Try to refresh token
    const refreshed = await tryRefresh(authBaseUrl);
    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('accessToken');
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers, credentials: 'include' });
    } else {
      // Refresh failed
      handleAuthFailure();
    }
  }

  return res;
}

async function tryRefresh(authBaseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${authBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!res.ok) return false;
    
    const data = await res.json();
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function handleSessionRevoked() {
  localStorage.removeItem('accessToken');
  
  // Redirect to auth.vyntrise.com with your platform details
  const platformId = process.env.NEXT_PUBLIC_PLATFORM_ID;
  const currentUrl = window.location.href;
  const redirectUrl = encodeURIComponent(
    `${window.location.origin}/auth/callback`
  );
  
  window.location.href = 
    `${process.env.NEXT_PUBLIC_AUTH_URL}/login?platformId=${platformId}&redirectUrl=${redirectUrl}&message=session-revoked`;
}

function handleAuthFailure() {
  localStorage.removeItem('accessToken');
  
  // Redirect to your platform's login page or to auth.vyntrise.com
  window.location.href = '/login?message=session-expired';
}
```

---

### Step 2: Create Middleware (Optional but Recommended)

For server-side validation, create middleware that checks sessions on protected routes.

#### Next.js Middleware Example

```typescript
// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate token with auth service
  try {
    const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://auth.vyntrise.com';
    const response = await fetch(`${authBaseUrl}/api/account/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': request.headers.get('cookie') || ''
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      
      if (data.message?.toLowerCase().includes('revoked')) {
        // Session revoked - clear cookies and redirect
        const res = NextResponse.redirect(new URL('/login?message=session-revoked', request.url));
        res.cookies.delete('accessToken');
        return res;
      }
      
      // Other auth errors
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth/* (authentication endpoints)
     * - /login, /register, /forgot-password (public pages)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     */
    '/((?!api/auth|login|register|forgot-password|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

### Step 3: Handle Session Revocation in Your Login Flow

Update your auth callback handler to show session revocation messages.

```typescript
// app/auth/callback/page.tsx or pages/auth/callback.tsx

'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const message = searchParams.get('message');

    if (message === 'session-revoked') {
      // Show notification that session was revoked
      router.push('/login?message=session-revoked');
      return;
    }

    if (token) {
      localStorage.setItem('accessToken', token);
      router.push('/dashboard'); // or your main page
    } else {
      router.push('/login?error=invalid-token');
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Authenticating...</p>
    </div>
  );
}
```

---

### Step 4: Add User Notification

Display a message when users are redirected due to session revocation.

```typescript
// app/login/page.tsx

'use client';

import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');

  const getNotification = () => {
    switch (message) {
      case 'session-revoked':
        return {
          type: 'warning',
          text: 'Your session has been revoked. Please sign in again.'
        };
      case 'session-expired':
        return {
          type: 'info',
          text: 'Your session has expired. Please sign in again.'
        };
      default:
        return null;
    }
  };

  const notification = getNotification();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full">
        {notification && (
          <div className={`mb-4 p-3 rounded ${
            notification.type === 'warning' 
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {notification.text}
          </div>
        )}
        
        {/* Your login form or SSO redirect button */}
        <button
          onClick={() => {
            const platformId = process.env.NEXT_PUBLIC_PLATFORM_ID;
            const redirectUrl = encodeURIComponent(
              `${window.location.origin}/auth/callback`
            );
            window.location.href = 
              `${process.env.NEXT_PUBLIC_AUTH_URL}/login?platformId=${platformId}&redirectUrl=${redirectUrl}`;
          }}
        >
          Sign in with Vyntrise
        </button>
      </div>
    </div>
  );
}
```

---

### Step 5: Environment Variables

Add these to your platform's environment configuration:

```env
# .env.local or .env

# Vyntrise Auth Service URL
NEXT_PUBLIC_AUTH_URL=https://auth.vyntrise.com

# Your Platform ID (get this from auth.vyntrise.com/admin/platforms)
NEXT_PUBLIC_PLATFORM_ID=your-platform-uuid-here

# JWT Secret (must match the auth service)
JWT_SECRET=same-secret-as-auth-service
```

---

## Alternative Implementations

### For Express/Node.js Backend

```javascript
// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

async function validateSession(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Verify JWT signature locally (fast)
    jwt.verify(token, process.env.JWT_SECRET);

    // Periodically validate with auth service (optional - for better performance)
    // You can cache validation results for a few minutes
    const authBaseUrl = process.env.AUTH_SERVICE_URL || 'https://auth.vyntrise.com';
    
    const response = await fetch(`${authBaseUrl}/api/account/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': req.headers.cookie || ''
      }
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      
      if (data.message?.toLowerCase().includes('revoked')) {
        return res.status(401).json({ 
          message: 'Session revoked. Please login again.',
          code: 'SESSION_REVOKED'
        });
      }
      
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userData = await response.json();
    req.user = userData;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { validateSession };
```

### For Python/Django

```python
# middleware/auth.py

import requests
import jwt
from django.http import JsonResponse
from django.conf import settings

class SessionValidationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Check if route requires authentication
        if self.requires_auth(request.path):
            token = self.get_token(request)
            
            if not token:
                return JsonResponse({'message': 'Unauthorized'}, status=401)
            
            # Verify JWT locally
            try:
                jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
            except jwt.InvalidTokenError:
                return JsonResponse({'message': 'Invalid token'}, status=401)
            
            # Validate with auth service
            auth_url = f"{settings.AUTH_SERVICE_URL}/api/account/me"
            response = requests.get(
                auth_url,
                headers={'Authorization': f'Bearer {token}'},
                cookies=request.COOKIES
            )
            
            if response.status_code != 200:
                data = response.json() if response.content else {}
                
                if 'revoked' in data.get('message', '').lower():
                    return JsonResponse({
                        'message': 'Session revoked. Please login again.',
                        'code': 'SESSION_REVOKED'
                    }, status=401)
                
                return JsonResponse({'message': 'Unauthorized'}, status=401)
            
            request.user_data = response.json()
        
        return self.get_response(request)
    
    def requires_auth(self, path):
        # Define paths that require authentication
        public_paths = ['/login', '/register', '/api/auth']
        return not any(path.startswith(p) for p in public_paths)
    
    def get_token(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            return auth_header[7:]
        return None
```

---

## Performance Optimization

### Caching Validation Results

To avoid hitting the auth service on every request, implement caching:

```typescript
// lib/sessionCache.ts

interface CacheEntry {
  valid: boolean;
  timestamp: number;
}

const sessionCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export async function validateSessionWithCache(
  token: string,
  refreshToken: string
): Promise<boolean> {
  const cacheKey = `${token.substring(0, 20)}-${refreshToken.substring(0, 20)}`;
  const cached = sessionCache.get(cacheKey);
  
  // Return cached result if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.valid;
  }
  
  // Validate with auth service
  const isValid = await validateWithAuthService(token, refreshToken);
  
  // Cache the result
  sessionCache.set(cacheKey, {
    valid: isValid,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries
  cleanupCache();
  
  return isValid;
}

async function validateWithAuthService(
  token: string, 
  refreshToken: string
): Promise<boolean> {
  try {
    const authBaseUrl = process.env.NEXT_PUBLIC_AUTH_URL;
    const response = await fetch(`${authBaseUrl}/api/account/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cookie': `refreshToken=${refreshToken}`
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of sessionCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      sessionCache.delete(key);
    }
  }
}
```

---

## Testing

### Test Session Revocation

1. **Login to your platform** (e.g., vyntrise-sms)
2. **Open auth.vyntrise.com** in another tab
3. **Go to Account Settings** → Active Sessions
4. **Revoke the session** for your platform
5. **Go back to your platform** and make any authenticated request
6. **Expected Result**: Immediate redirect to login with "session revoked" message

---

## Troubleshooting

### Issue: Session not being validated

**Cause**: Cookies not being sent with requests

**Solution**: Ensure `credentials: 'include'` is set on fetch requests and CORS is configured correctly

```typescript
fetch(url, {
  credentials: 'include', // This sends cookies
  // ... other options
});
```

### Issue: Performance degradation

**Cause**: Validating with auth service on every request

**Solution**: Implement caching as shown in the Performance Optimization section

### Issue: CORS errors when calling auth service

**Cause**: Your domain not in ALLOWED_ORIGINS environment variable

**Solution**: Add your platform's domain to the auth service backend `.env` file:

```env
# Development
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000,http://localhost:3002

# Production
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com,https://crm.vyntrise.com
```

**Important CORS Notes**:
- Never use `ALLOWED_ORIGINS=*` in production
- Include both HTTP (dev) and HTTPS (prod) as needed
- No trailing slashes in URLs
- Ensure `credentials: 'include'` is set in all fetch requests
- Restart backend server after changing ALLOWED_ORIGINS

---

## Summary

To implement session revocation in your platform:

1. ✅ Add session revocation detection to your API client
2. ✅ Handle 401 errors with "revoked" messages
3. ✅ Clear tokens and redirect to re-authenticate
4. ✅ Show user-friendly messages
5. ✅ Configure environment variables (AUTH_URL, PLATFORM_ID, JWT_SECRET)
6. ✅ Test the flow thoroughly

This ensures users are immediately logged out across all platforms when their session is revoked from auth.vyntrise.com.