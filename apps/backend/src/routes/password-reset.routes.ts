import { Router } from 'express';
import { forgotPassword, validateResetToken, resetPassword } from '../controllers/password-reset.controller';

const router = Router();

router.post('/forgot-password', forgotPassword);
router.get('/reset-password/:token', validateResetToken);
router.post('/reset-password', resetPassword);

export default router;
