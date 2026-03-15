import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { config } from '../config';
import { isAdmin } from '../utils/isAdmin';

export class AuthController {
  static async me(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const user = await AuthService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const admin = isAdmin(user.email, user.username);
      res.json({ user: { ...user, isAdmin: admin } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static getConfig(_req: Request, res: Response) {
    res.json({ need_check_email: config.needCheckEmail });
  }

  static async sendCode(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Missing email' });
      await AuthService.sendCode(email);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const { username, email, password, lang, code } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const result = await AuthService.register(username, email, password, lang, code);
      const admin = isAdmin(result.user.email, result.user.username);
      res.json({ token: result.token, user: { ...result.user, isAdmin: admin } });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const result = await AuthService.login(email, password);
      const admin = isAdmin(result.user.email, result.user.username);
      res.json({ ...result, user: { ...result.user, isAdmin: admin } });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }
}
