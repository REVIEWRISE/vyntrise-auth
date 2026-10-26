import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import {
  AdminRequest,
  loadAdminContext,
  requireAdmin,
  requireExplicitPlatform,
  requirePlatformAdminParam,
  requireSuperAdmin,
} from '../middlewares/admin.middleware';
import {
  authenticatePlatformKey,
  inviteKeyRateKey,
  inviteKeyAndEmailRateKey,
} from '../middlewares/platform-key.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import {
  getAdminMe,
  getDashboardStats,
  getInvites,
  createInvite,
  getPlatforms,
  getPlatformById,
  createPlatform,
  deletePlatform,
  updatePlatformSettings,
  updateUserRole,
  removeUserFromPlatform,
  revokeInvite,
  issuePlatformInviteKey,
  revokePlatformInviteKey,
  getPlatformInviteKeys,
  getSigningKeys,
  getSuperAdmins,
} from '../controllers/admin.controller';
import {
  getAnalyticsSummary,
  getAnalyticsTimeseries,
  getAnalyticsTop,
  getPlatformBreakdown,
} from '../controllers/admin-analytics.controller';
import {
  listAuditLog,
  getAuditMeta,
  getAuditEntry,
  exportAuditLog,
} from '../controllers/admin-audit.controller';
import {
  listPlatformUsers,
  listAllUsers,
  getUserDetail,
  listUserSessions,
  revokeUserSessions,
  disableUser,
  enableUser,
  resendUserVerification,
} from '../controllers/admin-users.controller';
import { createInviteViaKey } from '../controllers/platform-invite.controller';

const router = Router();

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// This endpoint sends mail on an unattended credential, so it gets the same shape of guardrail
// as resend-verification: a burst ceiling, a sustained ceiling, and a per-address ceiling so one
// mailbox cannot be flooded from our domain. All three count per key, never per IP — a
// platform's backend calls from one address and must not be able to spend another's budget.
const inviteKeyBurstLimiter = rateLimit(ONE_MINUTE, 20, inviteKeyRateKey);
const inviteKeyHourlyLimiter = rateLimit(ONE_HOUR, 200, inviteKeyRateKey);
const inviteKeyPerEmailLimiter = rateLimit(ONE_HOUR, 5, inviteKeyAndEmailRateKey);
// The per-key limits above can only run once a key has been resolved, which takes a database
// lookup — so on its own it leaves an unauthenticated caller able to make us do that lookup
// without limit. This one runs first, on IP, purely to bound that. Set well above what a real
// platform backend would ever send so it never interferes with the per-key ceilings.
const inviteEndpointIpLimiter = rateLimit(15 * ONE_MINUTE, 300);

// Exports walk up to 50k rows; a handful per admin per quarter hour is plenty.
const exportLimiter = rateLimit(15 * ONE_MINUTE, 10, (req) => `export:${(req as AdminRequest).user?.id}`);
// Each resend mails the user, so cap it per target as well as the user-facing endpoint does.
const adminResendLimiter = rateLimit(ONE_HOUR, 3, (req) => `resend:${req.params.userId}`);

// Every human-operated route below is JWT + one of the admin guards. A super-admin passes the
// platform-scoped guards for any platform; requireSuperAdmin routes are theirs alone.

router.get('/me', authenticateJWT, loadAdminContext, getAdminMe);
router.get('/stats', authenticateJWT, requireAdmin, getDashboardStats);

// ── Analytics (scoped: one platform, or everything for a super-admin) ─────────────────────────
router.get('/analytics/summary', authenticateJWT, loadAdminContext, getAnalyticsSummary);
router.get('/analytics/timeseries', authenticateJWT, loadAdminContext, getAnalyticsTimeseries);
router.get('/analytics/top', authenticateJWT, loadAdminContext, getAnalyticsTop);
router.get('/analytics/platforms', authenticateJWT, requireSuperAdmin, getPlatformBreakdown);

// ── Audit log ────────────────────────────────────────────────────────────────────────────────
router.get('/audit', authenticateJWT, loadAdminContext, listAuditLog);
router.get('/audit/meta', authenticateJWT, loadAdminContext, getAuditMeta);
router.get('/audit/export.csv', authenticateJWT, loadAdminContext, exportLimiter, exportAuditLog);
router.get('/audit/:id', authenticateJWT, loadAdminContext, getAuditEntry);

// ── Users ────────────────────────────────────────────────────────────────────────────────────
router.get('/users', authenticateJWT, requireAdmin, listPlatformUsers);
router.get('/users/all', authenticateJWT, requireSuperAdmin, listAllUsers);
router.get('/users/:userId', authenticateJWT, loadAdminContext, getUserDetail);
// Membership changes are scoped by requireAdmin to the platform named in the request, so an
// admin can only alter membership of a platform they administer — and requireExplicitPlatform
// makes sure that platform was actually named rather than inferred.
router.patch('/users/:userId', authenticateJWT, requireExplicitPlatform, requireAdmin, updateUserRole);
router.delete('/users/:userId', authenticateJWT, requireExplicitPlatform, requireAdmin, removeUserFromPlatform);
router.post(
  '/users/:userId/resend-verification',
  authenticateJWT,
  loadAdminContext,
  adminResendLimiter,
  resendUserVerification
);
// Sessions and the disabled flag belong to the account, which spans every platform, so these
// are super-admin only. A platform admin's tool is removing the user from their platform.
router.get('/users/:userId/sessions', authenticateJWT, requireSuperAdmin, listUserSessions);
router.delete('/users/:userId/sessions', authenticateJWT, requireSuperAdmin, revokeUserSessions);
router.delete('/users/:userId/sessions/:sessionId', authenticateJWT, requireSuperAdmin, revokeUserSessions);
router.post('/users/:userId/disable', authenticateJWT, requireSuperAdmin, disableUser);
router.post('/users/:userId/enable', authenticateJWT, requireSuperAdmin, enableUser);

// ── Invites ──────────────────────────────────────────────────────────────────────────────────
router.get('/invites', authenticateJWT, requireAdmin, getInvites);
router.post('/invites', authenticateJWT, requireExplicitPlatform, requireAdmin, createInvite);
router.delete('/invites/:id', authenticateJWT, requireExplicitPlatform, requireAdmin, revokeInvite);

// ── Platforms ────────────────────────────────────────────────────────────────────────────────
// getPlatforms lists what the caller administers (everything, for a super-admin). Creating a
// platform is super-admin only; it used to be open to any platform admin.
router.get('/platforms', authenticateJWT, loadAdminContext, getPlatforms);
router.post('/platforms', authenticateJWT, requireSuperAdmin, createPlatform);
router.get('/platforms/:id', authenticateJWT, requirePlatformAdminParam, getPlatformById);
router.patch('/platforms/:id', authenticateJWT, requirePlatformAdminParam, updatePlatformSettings);
router.delete('/platforms/:id', authenticateJWT, requireSuperAdmin, deletePlatform);

// Issue and revoke a platform's invite key. Human-operated, so JWT as usual — but scoped to the
// platform in the path, not "admin of any platform".
router.get('/platforms/:id/invite-keys', authenticateJWT, requirePlatformAdminParam, getPlatformInviteKeys);
router.post('/platforms/:id/invite-key', authenticateJWT, requirePlatformAdminParam, issuePlatformInviteKey);
router.delete('/platforms/:id/invite-key', authenticateJWT, requirePlatformAdminParam, revokePlatformInviteKey);

// ── System (super-admin) ─────────────────────────────────────────────────────────────────────
router.get('/system/signing-keys', authenticateJWT, requireSuperAdmin, getSigningKeys);
router.get('/system/super-admins', authenticateJWT, requireSuperAdmin, getSuperAdmins);

// Server-to-server. Deliberately NOT behind authenticateJWT: the caller is a platform backend
// holding a platform-scoped key, not a signed-in human. authenticatePlatformKey both
// authenticates the key and confirms it is bound to :platformId, so a key for one platform
// cannot create invitations for another.
router.post(
  '/platforms/:platformId/invites',
  inviteEndpointIpLimiter,
  authenticatePlatformKey,
  inviteKeyBurstLimiter,
  inviteKeyHourlyLimiter,
  inviteKeyPerEmailLimiter,
  createInviteViaKey
);

export default router;
