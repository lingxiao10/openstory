import pool from '../models/db';
import { UserModel } from '../models/UserModel';
import { config } from '../config';

export class QuotaService {
  /** Returns how many successful generations user has today */
  static async todayCount(userId: string): Promise<number> {
    const [rows] = await pool.execute<any[]>(
      `SELECT COUNT(*) AS cnt FROM generation_logs
       WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    return rows[0]?.cnt ?? 0;
  }

  /** Returns the effective daily limit for this user (user override > system default) */
  static async effectiveLimit(userId: string): Promise<number> {
    const user = await UserModel.findById(userId);
    if (user?.daily_quota != null) return user.daily_quota;
    return config.dailyGenLimit;
  }

  /**
   * Check if user can generate. Throws with code QUOTA_EXCEEDED if over limit.
   * Does NOT record — call recordSuccess() after generation completes.
   */
  static async check(userId: string): Promise<void> {
    if (!config.dailyGenLimitEnabled) return;
    const [count, limit] = await Promise.all([
      QuotaService.todayCount(userId),
      QuotaService.effectiveLimit(userId),
    ]);
    if (count >= limit) {
      const err: any = new Error(`今日生成次数已达上限（${limit}次），请联系开发者开通更多额度`);
      err.code = 'QUOTA_EXCEEDED';
      throw err;
    }
  }

  /** Record a successful generation */
  static async recordSuccess(userId: string, chapterId: string): Promise<void> {
    if (!config.dailyGenLimitEnabled) return;
    await pool.execute(
      'INSERT INTO generation_logs (user_id, chapter_id) VALUES (?, ?)',
      [userId, chapterId]
    );
  }

  /** Get user quota info for display */
  static async info(userId: string): Promise<{ used: number; limit: number; enabled: boolean }> {
    const [used, limit] = await Promise.all([
      QuotaService.todayCount(userId),
      QuotaService.effectiveLimit(userId),
    ]);
    return { used, limit, enabled: config.dailyGenLimitEnabled };
  }
}
