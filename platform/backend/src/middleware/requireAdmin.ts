import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/UserModel';
import { config } from '../config';

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!config.adminEmail) return res.status(403).json({ error: 'Admin not configured' });
  const user = await UserModel.findById(req.user.userId);
  if (!user || user.email !== config.adminEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}
