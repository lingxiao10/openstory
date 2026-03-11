import { Router } from 'express';
import { GenerateController } from '../controllers/GenerateController';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.post('/:storyId/:chapterId', GenerateController.generate);
export default router;
