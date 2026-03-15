import { Router } from 'express';
import { ProgressController } from '../controllers/ProgressController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.get('/', ProgressController.getMyProgress);
router.post('/:chapterId/complete', ProgressController.complete);

export default router;
