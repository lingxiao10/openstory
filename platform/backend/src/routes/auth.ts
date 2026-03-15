import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.get('/config', AuthController.getConfig);
router.get('/me', requireAuth, AuthController.me);
router.post('/send-code', AuthController.sendCode);
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
export default router;
