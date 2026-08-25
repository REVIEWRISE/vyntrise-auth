import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { rateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

const registerLimiter = rateLimit(15 * 60 * 1000, 20);

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/register', registerLimiter, register);

// Example protected route
router.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: (req as any).user });
});

export default router;
