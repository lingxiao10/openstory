import { Router, Request, Response, NextFunction } from 'express';
import { StreamGameController } from '../controllers/StreamGameController';
import { requireAuth } from '../middleware/auth';
import { AuthService } from '../services/AuthService';

const router = Router();

/**
 * SSE-compatible auth: accepts token from Authorization header OR ?token= query param.
 * EventSource (browser SSE) cannot set custom headers, so query param is the fallback.
 */
function requireAuthOrQuery(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return requireAuth(req, res, next);
  }
  // Fallback: read from query string (used by EventSource)
  const queryToken = req.query.token as string | undefined;
  if (!queryToken) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = AuthService.verifyToken(queryToken);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/start', requireAuth, StreamGameController.start);
router.get('/:storyId/events', requireAuthOrQuery, StreamGameController.events);
router.post('/:storyId/retry/:chapterNum', requireAuth, StreamGameController.retry);
router.get('/:storyId/status', requireAuthOrQuery, StreamGameController.status);

export default router;
