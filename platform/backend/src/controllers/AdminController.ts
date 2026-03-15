import { Request, Response } from 'express';
import { UserModel } from '../models/UserModel';
import { QuotaService } from '../services/QuotaService';
import { config } from '../config';

export class AdminController {
  static async searchUsers(req: Request, res: Response) {
    try {
      const q = String(req.query.q || '').trim();
      if (!q) return res.json([]);
      const users = await UserModel.search(q);
      const result = await Promise.all(users.map(async u => {
        const quota = await QuotaService.info(u.id);
        return {
          id: u.id,
          username: u.username,
          email: u.email,
          lang: u.lang,
          created_at: u.created_at,
          daily_quota: (u as any).daily_quota ?? null,
          quota_used_today: quota.used,
          effective_limit: quota.limit,
        };
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async setQuota(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { daily_quota } = req.body;
      const quota = daily_quota === null || daily_quota === '' ? null : parseInt(daily_quota);
      if (quota !== null && (isNaN(quota) || quota < 0)) {
        return res.status(400).json({ error: 'Invalid quota value' });
      }
      await UserModel.setDailyQuota(id, quota);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getConfig(_req: Request, res: Response) {
    res.json({
      daily_gen_limit_enabled: config.dailyGenLimitEnabled,
      daily_gen_limit: config.dailyGenLimit,
    });
  }
}
