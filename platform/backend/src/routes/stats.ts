import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/last7days', requireAuth, StatsController.getLast7Days);

export default router;
