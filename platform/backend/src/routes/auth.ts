import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';

const router = Router();
router.get('/config', AuthController.getConfig);
router.post('/send-code', AuthController.sendCode);
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
export default router;
