import { Router } from 'express';
import { forgotPassword, validateResetToken, resetPassword } from '../controllers/password-reset.controller';
import { rateLimit, ipAndEmailKey } from '../middlewares/rate-limit.middleware';

const router = Router();

const FIFTEEN_MIN = 15 * 60 * 1000;

// Unthrottled, /forgot-password lets anyone flood a target's inbox and burn the mail
// provider's sending quota, which would take password resets down for everyone.
const forgotLimiter = rateLimit(FIFTEEN_MIN, 5, ipAndEmailKey);
const resetLimiter = rateLimit(FIFTEEN_MIN, 20);

router.post('/forgot-password', forgotLimiter, forgotPassword);
router.get('/reset-password/:token', resetLimiter, validateResetToken);
router.post('/reset-password', resetLimiter, resetPassword);

export default router;
