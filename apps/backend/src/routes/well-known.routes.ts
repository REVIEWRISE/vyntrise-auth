import { Router } from 'express';
import { jwks, discovery } from '../controllers/well-known.controller';

const router = Router();

router.get('/jwks.json', jwks);
router.get('/openid-configuration', discovery);

export default router;
