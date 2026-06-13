import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/admin.middleware';
import { getDashboardStats, getUsers, getInvites } from '../controllers/admin.controller';

const router = Router();

// Protect all admin routes with JWT and Admin check
router.use(authenticateJWT, requireAdmin);

router.get('/stats', getDashboardStats);
router.get('/users', getUsers);
router.get('/invites', getInvites);

export default router;
