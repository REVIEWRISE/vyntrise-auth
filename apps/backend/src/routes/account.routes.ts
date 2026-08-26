import { Router } from 'express';
import {
  getMe,
  changeEmail,
  changePassword,
  getSessions,
  revokeSession,
  revokeOtherSessions,
  deleteAccount,
} from '../controllers/account.controller';

const router = Router();

router.get('/me', getMe);
router.patch('/email', changeEmail);
router.patch('/password', changePassword);
router.get('/sessions', getSessions);
// Declared before the :sessionId route so "sessions" isn't captured as an id.
router.delete('/sessions', revokeOtherSessions);
router.delete('/sessions/:sessionId', revokeSession);
router.delete('/', deleteAccount);

export default router;
