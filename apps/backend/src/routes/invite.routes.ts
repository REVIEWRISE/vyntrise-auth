import { Router } from 'express';
import { registerViaInvite } from '../controllers/invite.controller';

const router = Router();

// Endpoint for a user to register using an invite token
router.post('/register', registerViaInvite);

export default router;
