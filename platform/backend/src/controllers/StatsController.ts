import { Request, Response } from 'express';
import db from '../models/db';
import { isAdmin } from '../utils/isAdmin';

export class StatsController {
  static async getLast7Days(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      // Check if user is admin
      const [users] = await db.query('SELECT email, username FROM users WHERE id = ?', [userId]);
      const user = (users as any[])[0];
      if (!user || !isAdmin(user.email, user.username)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Get last 7 days stats
      const stats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // New users count
        const [newUsers] = await db.query(
          'SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = ?',
          [dateStr]
        );

        // Chapter reads count
        const [reads] = await db.query(
          'SELECT COUNT(*) as count FROM chapter_reads WHERE DATE(created_at) = ?',
          [dateStr]
        );

        // New users who read at least one chapter
        const [newUserReaders] = await db.query(
          `SELECT COUNT(DISTINCT cr.user_id) as count FROM chapter_reads cr
           JOIN users u ON u.id = cr.user_id
           WHERE DATE(u.created_at) = ?`,
          [dateStr]
        );

        // Total reads by new users
        const [newUserReads] = await db.query(
          `SELECT COUNT(*) as count FROM chapter_reads cr
           JOIN users u ON u.id = cr.user_id
           WHERE DATE(u.created_at) = ?`,
          [dateStr]
        );

        // New stories count
        const [newStories] = await db.query(
          'SELECT COUNT(*) as count FROM stories WHERE DATE(created_at) = ?',
          [dateStr]
        );

        // New users who created at least one story
        const [newUserStoriers] = await db.query(
          `SELECT COUNT(DISTINCT s.user_id) as count FROM stories s
           JOIN users u ON u.id = s.user_id
           WHERE DATE(u.created_at) = ?`,
          [dateStr]
        );

        stats.push({
          date: dateStr,
          newUsers: (newUsers as any[])[0]?.count || 0,
          reads: (reads as any[])[0]?.count || 0,
          newUserReaders: (newUserReaders as any[])[0]?.count || 0,
          newUserReads: (newUserReads as any[])[0]?.count || 0,
          newStories: (newStories as any[])[0]?.count || 0,
          newUserStoriers: (newUserStoriers as any[])[0]?.count || 0,
        });
      }

      res.json({ stats });
    } catch (err: any) {
      console.error('[StatsController] Error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
