import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import {
  getDashboardStats,
  getUsers,
  getInvites,
  createInvite,
  getPlatforms,
  getPlatformById,
  createPlatform,
} from '../controllers/admin.controller';

const router = Router();

// All routes: JWT + admin check
// getPlatforms is scoped to platforms the caller administers; createPlatform lets
// any platform admin self-provision a new platform (they become its admin)
router.get('/stats', authenticateJWT, requireAdmin, getDashboardStats);
router.get('/users', authenticateJWT, requireAdmin, getUsers);
router.get('/invites', authenticateJWT, requireAdmin, getInvites);
router.post('/invites', authenticateJWT, requireAdmin, createInvite);
router.get('/platforms', authenticateJWT, requireAdmin, getPlatforms);
router.post('/platforms', authenticateJWT, requireAdmin, createPlatform);
// getPlatformById does its own platform-specific admin check (route param, not query/body),
// so it doesn't go through the generic requireAdmin middleware.
router.get('/platforms/:id', authenticateJWT, getPlatformById);

export default router;
