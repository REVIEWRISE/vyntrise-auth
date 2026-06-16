# Integration Testing Guide

This guide helps you verify that your platform integration with Vyntrise Auth works correctly.

---

## Pre-Integration Checklist

Before testing, ensure you have:

- [ ] Created a platform in auth.vyntrise.com/admin/platforms
- [ ] Copied your Platform ID from the platforms page
- [ ] Set `JWT_SECRET` to match auth service (get from auth admin)
- [ ] Configured `NEXT_PUBLIC_AUTH_URL` (or equivalent)
- [ ] Implemented the auth API client from examples/nextjs-integration/lib/authApi.ts

---

## Test Suite

### 1. Basic SSO Login Flow

**Purpose**: Verify users can login via SSO

**Steps**:
1. Clear localStorage and cookies
2. Navigate to your app's main page
3. Click "Sign in with Vyntrise" (or equivalent)
4. Should redirect to: `auth.vyntrise.com/login?platformId=YOUR_ID&redirectUrl=...`
5. Login with test user credentials
6. Should redirect back to your app with `?token=...` in URL
7. Token should be stored in localStorage as `accessToken`

**Expected Result**: ✅ User is logged in and can access protected pages

**Troubleshooting**:
- If redirect fails: Check `redirectUrl` is properly encoded
- If token not stored: Check callback handler implementation
- If 403 error: Verify user has access to your platform

---

### 2. Session Revocation Detection

**Purpose**: Verify session revocation immediately logs user out

**Steps**:
1. Login to your platform
2. In another tab, open auth.vyntrise.com
3. Go to Account Settings → Active Sessions
4. Click "Revoke" on the session for your platform
5. Go back to your platform tab
6. Make any authenticated request (refresh page, click a button, etc.)

**Expected Result**: ✅ Immediate redirect to login with message "Your session has been revoked. Please sign in again."

**Troubleshooting**:
- If still logged in: Check `credentials: 'include'` is set on fetch requests
- If no redirect: Check API client detects "revoked" in error message
- If cookies persist: Ensure logout endpoint is called on revocation

---

### 3. Token Refresh Flow

**Purpose**: Verify tokens refresh automatically

**Steps**:
1. Login to your platform
2. Wait 15+ minutes (or manually expire access token)
3. Make an authenticated request

**Expected Result**: ✅ Request succeeds after automatic token refresh

**Troubleshooting**:
- If 401 error: Check refresh endpoint is `/api/auth/refresh`
- If no refresh: Verify `credentials: 'include'` sends cookies
- If infinite loop: Check refresh logic only retries once

---

### 4. Cross-Origin Cookie Handling

**Purpose**: Verify cookies work across subdomains

**Steps**:
1. Login from your platform (e.g., sms.vyntrise.com)
2. Open browser DevTools → Application → Cookies
3. Check for cookies: `refreshToken`, `vyntrise_session`
4. Verify Domain is set to `.vyntrise.com`

**Expected Result**: ✅ Cookies have correct domain and httpOnly flags

**Troubleshooting**:
- If cookies missing: Check auth service sets domain correctly
- If not httpOnly: Auth service needs to set cookie flags
- If wrong domain: Verify hostname includes 'vyntrise.com'

---

### 5. Platform Access Control

**Purpose**: Verify users can only access their platforms

**Steps**:
1. Create a test user with access to Platform A only
2. Login with this user
3. Try to access data from Platform B (if you have multiple platforms)

**Expected Result**: ✅ Access denied to Platform B

**Troubleshooting**:
- If access granted: Check backend validates platform access
- If user sees wrong platform: Verify login checks `platformId`

---

### 6. Role-Based Access

**Purpose**: Verify USER vs ADMIN roles work correctly

**Steps**:
1. Login as USER role
2. Try to access admin-only features

**Expected Result**: ✅ Access denied or admin features hidden

**Steps**:
1. Login as ADMIN role
2. Access admin features

**Expected Result**: ✅ Full access to admin features

**Troubleshooting**:
- If roles wrong: Check invitation role was set correctly
- If no role enforcement: Implement role checks in your app

---

### 7. Multi-Device Session Management

**Purpose**: Verify sessions work independently per device

**Steps**:
1. Login from Device A (Browser 1)
2. Login from Device B (Browser 2)
3. Both should have separate sessions
4. Revoke Device A session from account settings
5. Device A should logout, Device B should stay logged in

**Expected Result**: ✅ Independent session management

**Troubleshooting**:
- If both logout: Check session IDs are unique
- If neither logout: Verify revocation endpoint works

---

### 8. Invitation Flow

**Purpose**: Verify new users can register via invitation

**Steps**:
1. Create invitation from auth.vyntrise.com/admin/invites
2. Select your platform and role
3. Copy registration link
4. Open link in incognito/private window
5. Set password and complete registration
6. Login to your platform

**Expected Result**: ✅ User can login and has correct platform access

**Troubleshooting**:
- If 404: Check invitation link includes token parameter
- If wrong platform: Verify platformId in invitation
- If no access: Check registration links user to platform

---

## API Endpoint Verification

Test these endpoints return expected responses:

### GET /api/account/me
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN" \
     https://auth.vyntrise.com/api/account/me
```

**Expected**: User profile with platforms array

### POST /api/auth/refresh
```bash
curl -X POST \
     -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN" \
     https://auth.vyntrise.com/api/auth/refresh
```

**Expected**: New access token

### POST /api/auth/logout
```bash
curl -X POST \
     -H "Cookie: refreshToken=YOUR_REFRESH_TOKEN" \
     https://auth.vyntrise.com/api/auth/logout
```

**Expected**: Success message, cookies cleared

---

## Code Verification Checklist

Review your implementation against these requirements:

### API Client (authApi.ts or equivalent)

- [ ] Adds `Authorization: Bearer ${token}` header
- [ ] Sets `credentials: 'include'` on all requests
- [ ] Detects 401/403 errors
- [ ] Checks for "revoked" in error messages
- [ ] Clears localStorage on revocation
- [ ] Redirects to login on revocation
- [ ] Attempts token refresh on 401/403
- [ ] Only retries once (prevents infinite loops)

### Environment Configuration

- [ ] `NEXT_PUBLIC_AUTH_URL` or equivalent is set
- [ ] `NEXT_PUBLIC_PLATFORM_ID` is set
- [ ] `JWT_SECRET` matches auth service
- [ ] All URLs use HTTPS in production

### Callback Handler

- [ ] Reads `token` from URL query parameter
- [ ] Stores token in localStorage as `accessToken`
- [ ] Handles `message=session-revoked` parameter
- [ ] Redirects to main app page after successful login
- [ ] Shows error for invalid/missing tokens

### Login Page/Button

- [ ] Constructs correct auth URL with platformId
- [ ] Encodes redirectUrl parameter
- [ ] Shows session revoked message when parameter present
- [ ] Clears old tokens before redirecting to auth

---

## Performance Testing

### Session Validation Overhead

1. Make 100 authenticated requests
2. Measure average response time
3. Session validation should add <50ms per request

**Optimization**: Implement caching (see SSO_SESSION_VALIDATION_GUIDE.md)

---

## Common Integration Issues

### Issue: "Session revoked" but user stays logged in

**Cause**: Not including credentials with requests

**Fix**:
```typescript
fetch(url, {
  credentials: 'include', // Add this
  headers: { ... }
})
```

---

### Issue: CORS errors when calling auth service

**Cause**: Your domain not in ALLOWED_ORIGINS

**Fix**: Add your domain to auth backend `.env`:
```env
ALLOWED_ORIGINS=http://localhost:3001,https://your-platform.vyntrise.com
```

Then restart the backend server.

---

### Issue: Tokens not refreshing

**Cause**: Refresh token cookie not being sent

**Fix**: Ensure `credentials: 'include'` on refresh endpoint

---

### Issue: Users see wrong platform data

**Cause**: Not validating platform access in your app

**Fix**: Check user's platform list from `/api/account/me`

---

### Issue: Invitation links return 404

**Cause**: Token parameter missing or malformed

**Fix**: Check invitation email template includes full URL with token

---

## Security Verification

- [ ] Refresh tokens are HTTP-only (not accessible via JavaScript)
- [ ] Access tokens expire in 15 minutes
- [ ] HTTPS used in production
- [ ] Cookies set with `Secure` flag in production
- [ ] No tokens logged to console
- [ ] No sensitive data in URL parameters (except token in callback)

---

## Load Testing (Production)

### Scenario 1: Concurrent Logins
- 100 users login simultaneously
- All should complete within 10 seconds

### Scenario 2: Token Refresh Spike
- 500 tokens expire at same time
- All should refresh successfully

### Scenario 3: Session Validation
- 1000 requests with session validation
- Response time should remain acceptable

---

## Final Checklist

Before deploying to production:

- [ ] All tests pass in staging environment
- [ ] Session revocation works correctly
- [ ] Token refresh is reliable
- [ ] Error messages are user-friendly
- [ ] Environment variables set for production
- [ ] HTTPS enabled
- [ ] Monitoring/logging in place
- [ ] Backup authentication method exists (if needed)

---

## Getting Help

If tests fail:

1. Check [SSO_INTEGRATION_GUIDE.md](./SSO_INTEGRATION_GUIDE.md) for setup steps
2. Review [SSO_SESSION_VALIDATION_GUIDE.md](./SSO_SESSION_VALIDATION_GUIDE.md) for implementation details
3. Compare your code to [examples/nextjs-integration/](./examples/nextjs-integration/)
4. Verify environment variables match requirements
5. Check browser console and network tab for errors

---

**Test Status Template**

Copy and fill out as you test:

```
Integration Testing - [Your Platform Name]
Date: ___________
Tester: ___________

[ ] Basic SSO Login Flow
[ ] Session Revocation Detection  
[ ] Token Refresh Flow
[ ] Cross-Origin Cookie Handling
[ ] Platform Access Control
[ ] Role-Based Access
[ ] Multi-Device Session Management
[ ] Invitation Flow

Issues Found:
1. ___________
2. ___________

Notes:
___________
```
