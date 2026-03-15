import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { AdminController } from '../controllers/AdminController';

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get('/config', AdminController.getConfig);
router.get('/users', AdminController.searchUsers);
router.patch('/users/:id/quota', AdminController.setQuota);

export default router;
