import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = AuthService.verifyToken(token);
    (req as any).userId = payload.userId;
    (req as any).username = payload.username;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
