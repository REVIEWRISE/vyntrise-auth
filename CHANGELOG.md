 # Changelog

All notable changes to the Vyntrise Auth project.

---

## [1.0.0] - 2026-06-16

### 🎉 Major Features

#### Session Revocation System
- **Backend**: Enhanced auth middleware to validate sessions on every request
- **Frontend**: API client detects and handles session revocation
- **Cross-Platform**: Sessions revoked from auth.vyntrise.com immediately affect all connected platforms
- **User Experience**: Clear notifications when sessions are revoked

**Impact**: Users can now revoke sessions and be immediately logged out across all devices and platforms.

#### Platform-Specific Invitations
- **Backend**: Invitations now include `platformId` and `role` fields
- **Frontend**: Admin UI updated with platform selector dropdown
- **Database**: Migration added for invitation role field
- **Logic**: Users can be invited to specific platforms with specific roles

**Impact**: Fine-grained access control - invite users to individual platforms with appropriate roles.

#### Email Service Generalization
- **SMTP Provider**: Added generic SMTP support for any email service
- **Multi-Provider**: Supports console, SMTP (generic), and Gmail
- **Configuration**: Works with SendGrid, Mailgun, AWS SES, custom SMTP
- **Documentation**: Comprehensive EMAIL_SETUP.md guide

**Impact**: Production-ready email system that works with professional email services.

#### Account Management UI Enhancement
- **Navigation**: Added "My Account" link to admin sidebar
- **Back Button**: Account page shows "Back to Admin" for admin users
- **Sign Out**: Added logout button to account page
- **UX**: Seamless navigation between admin and account sections

**Impact**: Users can easily manage their personal settings while accessing admin functions.

---

### 📚 Documentation

#### New Guides
- ✅ `DOCUMENTATION_INDEX.md` - Complete navigation guide for all documentation
- ✅ `SSO_SESSION_VALIDATION_GUIDE.md` - Session revocation implementation guide
- ✅ `EMAIL_SETUP.md` - Email service configuration guide
- ✅ `CHANGELOG.md` - This file

#### Updated Guides
- ✅ `README.md` - Added documentation index link, email config, SSO quick links
- ✅ `SSO_INTEGRATION_GUIDE.md` - Added session revocation security notes
- ✅ `.env.example` - Updated with SMTP configuration options

#### Examples
- ✅ `examples/nextjs-integration/` - Complete Next.js reference implementation
  - `lib/authApi.ts` - Auth API client with session revocation
  - `.env.example` - Environment configuration template
  - `README.md` - Quick start guide

---

### 🔐 Security Enhancements

#### Session Validation
- Auth middleware now checks if sessions exist in database
- Revoked sessions immediately trigger 401 responses
- Cookies cleared on session revocation
- Frontend redirects to login with clear messaging

#### Token Management
- Access tokens: 15 minutes (short-lived)
- Refresh tokens: 7 days (HTTP-only cookies)
- Sessions tracked and can be revoked individually
- Password changes invalidate other sessions

---

### 🗃️ Database Changes

#### New Migrations
- `20260616124142_add_role_to_invitation` - Added `role` field to Invitation model

#### Schema Updates
```prisma
model Invitation {
  id         String   @id @default(uuid())
  email      String
  platformId String
  role       String   @default("USER") // NEW: Role for platform access
  token      String   @unique
  expiresAt  DateTime
  isUsed     Boolean  @default(false)
  createdAt  DateTime @default(now())

  platform Platform @relation(fields: [platformId], references: [id])

  @@unique([email, platformId])
}
```

---

### 🎨 Frontend Changes

#### Admin Panel
- **Invitations Page**: Added platform selector and role column
- **Admin Layout**: Added "My Account" navigation link
- **Platforms Page**: Displays platform IDs for SSO integration

#### Account Page
- **Navigation Bar**: Shows "Back to Admin" and "Sign Out" buttons
- **Session Management**: Enhanced revocation with self-detection
- **Role Detection**: Automatically detects admin status

#### Login Page
- **Messages**: Shows session revoked notification
- **UX**: Clear feedback on why user was redirected

---

### 🔧 Backend Changes

#### Controllers
- **account.controller.ts**: Enhanced session revocation handling
- **admin.controller.ts**: Updated invitation creation with role and platform
- **invite.controller.ts**: Improved registration logic for existing users

#### Middleware
- **auth.middleware.ts**: Added session validation to `authenticateJWT`
  - Now async to support database queries
  - Validates refresh token exists in database
  - Clears cookies on revoked sessions

#### Services
- **email.service.ts**: Added SMTP provider option
- **smtp.provider.ts**: NEW - Generic SMTP implementation

---

### 📦 Dependencies

No new dependencies added. All features use existing packages:
- `jsonwebtoken` - Token validation
- `bcrypt` - Session hash comparison  
- `nodemailer` - Email sending
- `@prisma/client` - Database access

---

### 🧪 Testing Recommendations

#### Session Revocation
1. Login from multiple browsers/devices
2. Go to Account Settings → Active Sessions
3. Revoke a session
4. Verify immediate logout on revoked device

#### Platform-Specific Invitations
1. Create platform in admin panel
2. Generate invitation with specific platform and role
3. Register with invitation link
4. Verify user has correct platform access and role

#### Email Configuration
1. Configure SMTP provider in .env
2. Trigger password reset
3. Verify email delivery
4. Test invitation emails

---

### 🚀 Deployment Notes

#### Environment Variables
Ensure these are set in production:
- `JWT_SECRET` - Must be shared across all platforms
- `EMAIL_PROVIDER` - Set to `smtp` for production
- `SMTP_HOST`, `SMTP_PORT`, etc. - Configure your email service
- `FRONTEND_URL` - Your auth service frontend URL

#### Database Migrations
Run migrations to update schema:
```bash
cd apps/backend
npx prisma migrate deploy
```

#### Nginx Configuration
No changes required - existing config works with all updates.

---

### 📋 Migration Guide

#### For Platform Developers

**Before**: Tokens worked until expiry even if session was revoked

**After**: Implement session validation in your platform

**Action Required**:
1. Read `SSO_SESSION_VALIDATION_GUIDE.md`
2. Copy `examples/nextjs-integration/lib/authApi.ts` to your project
3. Update your API client to detect session revocation
4. Configure `NEXT_PUBLIC_AUTH_URL` and `JWT_SECRET`
5. Test the flow

#### For Auth Service Administrators

**Before**: Limited email provider options (console or Gmail only)

**After**: Generic SMTP support for any email service

**Action Required**:
1. Read `apps/backend/EMAIL_SETUP.md`
2. Choose email provider (recommend SMTP for production)
3. Update `.env` with SMTP credentials
4. Test email delivery

---

### 🐛 Bug Fixes

- Fixed: Sessions not being invalidated after revocation (now enforced immediately)
- Fixed: Invitation UI not showing platform selection
- Fixed: Email service tied to Gmail only
- Fixed: Account page not accessible from admin panel

---

### ⚡ Performance

- Session validation adds ~1 database query per authenticated request
- Minimal overhead with proper indexing on Session table
- Caching strategies documented for high-traffic scenarios

---

### 🔮 Future Enhancements

Potential improvements for future versions:
- [ ] Session validation caching layer
- [ ] Batch session revocation
- [ ] Session activity logging
- [ ] Email template customization UI
- [ ] Multi-factor authentication (MFA)
- [ ] OAuth provider integration
- [ ] Session device fingerprinting
- [ ] Rate limiting on auth endpoints

---

### 👥 Contributors

- Kiro AI Assistant

---

### 📄 License

Internal Vyntrise Project

---

**Full Documentation**: See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for complete guide navigation.
