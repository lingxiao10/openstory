import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { config } from '../config';

export class AuthController {
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
      const token = await AuthService.register(username, email, password, lang, code);
      res.json({ token });
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
      const isAdmin = !!(config.adminEmail && result.user.email === config.adminEmail);
      res.json({ ...result, user: { ...result.user, isAdmin } });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }
}
