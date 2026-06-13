import { Router } from 'express';
import { login, logout, refresh } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);

// Example protected route
router.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: (req as any).user });
});

export default router;
