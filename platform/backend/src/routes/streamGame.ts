import { Router } from 'express';
import { StreamGameController } from '../controllers/StreamGameController';
import { requireAuth } from '../middleware/auth';

const router = Router();


router.post('/start', requireAuth, StreamGameController.start);
router.post('/:storyId/resume', StreamGameController.resume);
router.get('/:storyId/events', StreamGameController.events);
router.post('/:storyId/retry/:chapterNum', requireAuth, StreamGameController.retry);
router.get('/:storyId/status', StreamGameController.status);

export default router;
