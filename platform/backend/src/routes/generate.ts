import { Router } from 'express';
import { GenerateController } from '../controllers/GenerateController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.get('/progress/:key', GenerateController.progressByKey);
export default router;
