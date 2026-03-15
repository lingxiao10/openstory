import { Request, Response } from 'express';
import db from '../models/db';

export class ReadController {
  static async recordRead(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const { chapterId } = req.body;

      if (!userId || !chapterId) {
        return res.status(400).json({ error: 'Missing userId or chapterId' });
      }

      await db.query(
        'INSERT INTO chapter_reads (user_id, chapter_id) VALUES (?, ?)',
        [userId, chapterId]
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('[ReadController] Error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
