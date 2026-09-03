import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import {
  requireAdmin,
  requireExplicitPlatform,
  requirePlatformAdminParam,
} from '../middlewares/admin.middleware';
import {
  authenticatePlatformKey,
  inviteKeyRateKey,
  inviteKeyAndEmailRateKey,
} from '../middlewares/platform-key.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';
import {
  getDashboardStats,
  getUsers,
  getInvites,
  createInvite,
  getPlatforms,
  getPlatformById,
  createPlatform,
  updatePlatformSettings,
  updateUserRole,
  removeUserFromPlatform,
  revokeInvite,
  issuePlatformInviteKey,
  revokePlatformInviteKey,
} from '../controllers/admin.controller';
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

// All routes: JWT + admin check
// getPlatforms is scoped to platforms the caller administers; createPlatform lets
// any platform admin self-provision a new platform (they become its admin)
router.get('/stats', authenticateJWT, requireAdmin, getDashboardStats);
router.get('/users', authenticateJWT, requireAdmin, getUsers);
// Membership changes are scoped by requireAdmin to the platform named in the request, so an
// admin can only alter membership of a platform they administer — and requireExplicitPlatform
// makes sure that platform was actually named rather than inferred.
router.patch('/users/:userId', authenticateJWT, requireExplicitPlatform, requireAdmin, updateUserRole);
router.delete('/users/:userId', authenticateJWT, requireExplicitPlatform, requireAdmin, removeUserFromPlatform);
router.get('/invites', authenticateJWT, requireAdmin, getInvites);
router.post('/invites', authenticateJWT, requireExplicitPlatform, requireAdmin, createInvite);
router.delete('/invites/:id', authenticateJWT, requireExplicitPlatform, requireAdmin, revokeInvite);
router.get('/platforms', authenticateJWT, requireAdmin, getPlatforms);
router.post('/platforms', authenticateJWT, requireAdmin, createPlatform);
// getPlatformById does its own platform-specific admin check (route param, not query/body),
// so it doesn't go through the generic requireAdmin middleware.
router.get('/platforms/:id', authenticateJWT, getPlatformById);
// updatePlatformSettings does its own platform-specific admin check, same as getPlatformById.
router.patch('/platforms/:id', authenticateJWT, updatePlatformSettings);

// Issue and revoke a platform's invite key. Human-operated, so JWT as usual — but scoped to the
// platform in the path, not "admin of any platform".
router.post('/platforms/:id/invite-key', authenticateJWT, requirePlatformAdminParam, issuePlatformInviteKey);
router.delete('/platforms/:id/invite-key', authenticateJWT, requirePlatformAdminParam, revokePlatformInviteKey);

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
