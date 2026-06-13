import { Router } from 'express';
import { createInvite, registerViaInvite } from '../controllers/invite.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint for a platform admin to create an invite
router.post('/create', authenticateJWT, createInvite);

// Endpoint for a user to register using an invite token
router.post('/register', registerViaInvite);

export default router;
