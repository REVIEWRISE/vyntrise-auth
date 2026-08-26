import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { rateLimit, ipAndEmailKey, emailOnlyKey } from '../middlewares/rate-limit.middleware';

const router = Router();

const FIFTEEN_MIN = 15 * 60 * 1000;

const registerLimiter = rateLimit(FIFTEEN_MIN, 20);
// Two ceilings on login: one per IP+account pair to stop a sustained run against a single
// account, and a looser per-account one so distributing the attempts across many IPs still
// gets throttled.
const loginLimiter = rateLimit(FIFTEEN_MIN, 10, ipAndEmailKey);
const loginAccountLimiter = rateLimit(FIFTEEN_MIN, 25, emailOnlyKey);

router.post('/login', loginLimiter, loginAccountLimiter, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/register', registerLimiter, register);

// Example protected route
router.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: (req as any).user });
});

export default router;
