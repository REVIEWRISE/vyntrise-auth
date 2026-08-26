import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin, requireExplicitPlatform } from '../middlewares/admin.middleware';
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
} from '../controllers/admin.controller';

const router = Router();

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

export default router;
