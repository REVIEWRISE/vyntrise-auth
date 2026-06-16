# CORS Setup Guide

This guide explains how to configure Cross-Origin Resource Sharing (CORS) for the Vyntrise Auth service to work with external platforms.

---

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security feature that controls which domains can make requests to your API. When your platform (e.g., `sms.vyntrise.com`) needs to call the auth service (`auth.vyntrise.com`), the browser enforces CORS policies.

---

## Configuration

### Backend Configuration

In `apps/backend/.env`, set the `ALLOWED_ORIGINS` variable:

```env
# Development - Include all local development URLs
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000,http://localhost:3002

# Production - Only include actual production domains
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com,https://crm.vyntrise.com
```

**Important Rules**:
- ✅ Comma-separated list of origins
- ✅ No spaces between entries
- ✅ No trailing slashes
- ✅ Include protocol (http:// or https://)
- ❌ Never use `*` in production
- ❌ Don't mix HTTP and HTTPS in production

---

## Common CORS Errors

### Error: "Access to fetch has been blocked by CORS policy"

**Full Error**:
```
Access to fetch at 'https://auth.vyntrise.com/api/auth/refresh' 
from origin 'https://sms.vyntrise.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Cause**: Your platform's origin is not in `ALLOWED_ORIGINS`

**Solution**:
1. Add your domain to backend `.env`:
   ```env
   ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com
   ```
2. Restart the backend server
3. Clear browser cache and try again

---

### Error: "Credentials flag is 'true', but Access-Control-Allow-Credentials is not"

**Full Error**:
```
Access to fetch at 'https://auth.vyntrise.com/api/auth/refresh' 
from origin 'https://sms.vyntrise.com' has been blocked by CORS policy: 
The value of the 'Access-Control-Allow-Credentials' header in the response 
is '' which must be 'true' when the request's credentials mode is 'include'.
```

**Cause**: `credentials: 'include'` in frontend but CORS not configured for credentials

**Solution**: This should be automatic with our CORS setup, but verify:
1. Backend `server.ts` has `credentials: true` in CORS config ✅
2. Frontend requests include `credentials: 'include'` ✅
3. Your domain is in `ALLOWED_ORIGINS` ✅

---

### Error: "The request client is not a secure context and the resource is in more-private address space"

**Cause**: Trying to use HTTP in production or mixed content

**Solution**: Use HTTPS for all production URLs

---

## Frontend Configuration

Ensure all fetch requests include `credentials: 'include'`:

```typescript
fetch('https://auth.vyntrise.com/api/auth/refresh', {
  method: 'POST',
  credentials: 'include', // CRITICAL: Sends cookies
  headers: {
    'Content-Type': 'application/json'
  }
});
```

---

## Testing CORS Configuration

### Test 1: Check CORS Headers

```bash
curl -H "Origin: https://sms.vyntrise.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://auth.vyntrise.com/api/auth/refresh
```

**Expected Response Headers**:
```
Access-Control-Allow-Origin: https://sms.vyntrise.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
```

### Test 2: Verify in Browser

1. Open DevTools → Network tab
2. Make a request to auth service
3. Click on the request
4. Check "Response Headers" for:
   - `Access-Control-Allow-Origin: <your-origin>`
   - `Access-Control-Allow-Credentials: true`

---

## Development vs Production

### Development Setup

```env
# Backend .env
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000,http://localhost:3002
NODE_ENV=development
```

**Features**:
- HTTP allowed
- Multiple local ports
- Easier debugging

### Production Setup

```env
# Backend .env
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com,https://crm.vyntrise.com
NODE_ENV=production
```

**Features**:
- HTTPS only
- Specific domains only
- Secure cookies enabled
- No wildcards

---

## Subdomain Strategy

If all platforms are on `*.vyntrise.com` subdomains:

### Option 1: List All Subdomains (Recommended)
```env
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com,https://crm.vyntrise.com
```

**Pros**: Explicit, secure  
**Cons**: Need to add new subdomains

### Option 2: Cookie Domain Strategy
Set cookies with `.vyntrise.com` domain (already implemented):
```typescript
res.cookie('refreshToken', token, {
  domain: '.vyntrise.com', // Shares across subdomains
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
});
```

---

## Nginx Configuration

If using nginx as a reverse proxy, add CORS headers:

```nginx
location /api/ {
    # CORS Headers
    add_header 'Access-Control-Allow-Origin' $http_origin always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Platform-Id' always;

    # Handle preflight
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Max-Age' 1728000;
        add_header 'Content-Type' 'text/plain; charset=utf-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    proxy_pass http://backend:3021;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Note**: Our Express app already handles CORS, so nginx config is optional.

---

## Security Best Practices

### ✅ DO

- Use specific origins in production
- Always use HTTPS in production
- Set `credentials: true` only when needed
- Log blocked CORS requests for monitoring
- Validate origin format before adding to ALLOWED_ORIGINS

### ❌ DON'T

- Use `*` wildcard in production
- Mix HTTP and HTTPS in production
- Allow untrusted origins
- Expose internal APIs via CORS
- Forget to restart server after CORS changes

---

## Troubleshooting Checklist

When experiencing CORS issues, check:

- [ ] Is your origin in `ALLOWED_ORIGINS`?
- [ ] Did you restart the backend server?
- [ ] Are you using the correct protocol (http/https)?
- [ ] Is `credentials: 'include'` set on frontend requests?
- [ ] Are cookies being sent? (Check DevTools → Application → Cookies)
- [ ] Is the URL correct (no typos, no trailing slashes)?
- [ ] Are you in the same browser context? (not private/incognito mixed)
- [ ] Is the backend server running?
- [ ] Are there any proxy/nginx issues?

---

## Example Configurations

### Scenario 1: Single Platform Development

```env
# Backend .env
ALLOWED_ORIGINS=http://localhost:3001
```

### Scenario 2: Multiple Local Platforms

```env
# Backend .env
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002,http://localhost:3003
```

### Scenario 3: Production Multi-Platform

```env
# Backend .env
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://sms.vyntrise.com,https://crm.vyntrise.com,https://admin.vyntrise.com
```

### Scenario 4: Staging + Production

```env
# Backend .env
ALLOWED_ORIGINS=https://auth.vyntrise.com,https://staging-auth.vyntrise.com,https://sms.vyntrise.com,https://staging-sms.vyntrise.com
```

---

## Advanced: Dynamic Origins

For platforms with many subdomains, you can modify `server.ts`:

```typescript
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Allow all *.vyntrise.com subdomains
    const allowedPattern = /^https:\/\/([a-z0-9-]+\.)?vyntrise\.com$/;
    
    if (allowedPattern.test(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
```

**Warning**: Only use pattern matching in controlled environments.

---

## Getting Help

If CORS issues persist:

1. Check browser console for exact error message
2. Verify backend logs show your origin
3. Test with curl to isolate browser issues
4. Check if domain DNS is resolving correctly
5. Verify SSL certificates are valid (if HTTPS)

---

**Related Documentation**:
- [SSO Integration Guide](./SSO_INTEGRATION_GUIDE.md)
- [Integration Testing Guide](./INTEGRATION_TESTING_GUIDE.md)
- [README.md](./README.md)
