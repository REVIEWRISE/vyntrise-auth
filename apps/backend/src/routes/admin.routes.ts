import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import {
  getDashboardStats,
  getUsers,
  getInvites,
  createInvite,
  getPlatforms,
  createPlatform,
} from '../controllers/admin.controller';

const router = Router();

// All routes: JWT + admin check
// getPlatforms/createPlatform are also admin-only but don't filter by platformId
router.get('/stats', authenticateJWT, requireAdmin, getDashboardStats);
router.get('/users', authenticateJWT, requireAdmin, getUsers);
router.get('/invites', authenticateJWT, requireAdmin, getInvites);
router.post('/invites', authenticateJWT, requireAdmin, createInvite);
router.get('/platforms', authenticateJWT, requireAdmin, getPlatforms);
router.post('/platforms', authenticateJWT, requireAdmin, createPlatform);

export default router;
