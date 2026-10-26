import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/auth.controller';
import {
  verifyEmail,
  validateVerificationToken,
  resendVerification,
} from '../controllers/email-verification.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { isRedirectAllowed } from '../services/platform-security.service';
import { rateLimit, ipAndEmailKey, emailOnlyKey } from '../middlewares/rate-limit.middleware';

const router = Router();

const FIFTEEN_MIN = 15 * 60 * 1000;

const registerLimiter = rateLimit(FIFTEEN_MIN, 20);
// Two ceilings on login: one per IP+account pair to stop a sustained run against a single
// account, and a looser per-account one so distributing the attempts across many IPs still
// gets throttled.
const loginLimiter = rateLimit(FIFTEEN_MIN, 10, ipAndEmailKey);
const loginAccountLimiter = rateLimit(FIFTEEN_MIN, 25, emailOnlyKey);
// Resending is an unauthenticated trigger for outbound mail, so it is capped per address as
// well as per IP — otherwise it is a free way to flood someone's inbox from our domain.
const resendLimiter = rateLimit(FIFTEEN_MIN, 5, ipAndEmailKey);
const resendAccountLimiter = rateLimit(60 * 60 * 1000, 5, emailOnlyKey);
// Confirmation tokens are unguessable, so this is not about brute force — it stops an
// unauthenticated caller turning a token probe into a database query flood. Mirrors the
// ceiling the password-reset token routes already use.
const verifyLimiter = rateLimit(FIFTEEN_MIN, 20);
// The login page asks this before handing a token to a redirect target. Cheap, but it is an
// unauthenticated database read, so it gets a ceiling well above any real sign-in rate.
const redirectCheckLimiter = rateLimit(FIFTEEN_MIN, 120);

router.post('/login', loginLimiter, loginAccountLimiter, login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/register', registerLimiter, register);

router.get('/verify-email/:token', verifyLimiter, validateVerificationToken);
router.post('/verify-email', verifyLimiter, verifyEmail);
router.post('/resend-verification', resendLimiter, resendAccountLimiter, resendVerification);

// Answers only allowed: true/false, so it reveals nothing about which platforms exist or what
// they have configured beyond whether this one URL would be accepted.
router.get('/redirect-check', redirectCheckLimiter, async (req, res) => {
  const platformId = typeof req.query.platformId === 'string' ? req.query.platformId : null;
  const redirectUrl = typeof req.query.redirectUrl === 'string' ? req.query.redirectUrl : '';
  try {
    res.json({ allowed: await isRedirectAllowed(platformId, redirectUrl) });
  } catch (error) {
    console.error('redirect-check error:', error);
    res.json({ allowed: false });
  }
});

// Example protected route
router.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: (req as any).user });
});

export default router;
