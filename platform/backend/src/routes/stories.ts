import { Router } from 'express';
import { StoryController } from '../controllers/StoryController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public routes (no auth)
router.get('/public', StoryController.listPublic);
router.get('/public/:id', StoryController.getPublic);

// Auth-required routes
router.use(requireAuth);
router.post('/', StoryController.create);
router.get('/', StoryController.list);
router.get('/:id', StoryController.get);
router.post('/:id/chapters', StoryController.addChapter);
router.delete('/:id/chapters/:chapterId', StoryController.deleteChapter);
router.post('/:id/chapters/:chapterId/publish', StoryController.publishChapter);

export default router;
