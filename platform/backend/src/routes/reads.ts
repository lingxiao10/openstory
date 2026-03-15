import { Router } from 'express';
import { ReadController } from '../controllers/ReadController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/record', requireAuth, ReadController.recordRead);

export default router;
