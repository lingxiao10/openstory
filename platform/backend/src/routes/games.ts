import { Router } from 'express';
import { GameController } from '../controllers/GameController';

const router = Router();
router.get('/', GameController.getIndex);
router.get('/:id', GameController.getGame);
export default router;
