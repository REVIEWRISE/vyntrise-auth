import { Router } from 'express';
import {
  getMe,
  changeEmail,
  changePassword,
  getSessions,
  revokeSession,
  deleteAccount,
} from '../controllers/account.controller';

const router = Router();

router.get('/me', getMe);
router.patch('/email', changeEmail);
router.patch('/password', changePassword);
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.delete('/', deleteAccount);

export default router;
