import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/UserModel';
import { isAdmin } from '../utils/isAdmin';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const user = await UserModel.findById(req.user.userId);
  if (!user || !isAdmin(user.email, user.username)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
