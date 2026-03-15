import { Request, Response } from 'express';
import { ProgressModel } from '../models/ProgressModel';

export class ProgressController {
  static async complete(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      const userId = (req as any).userId;
      await ProgressModel.complete(userId, chapterId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getMyProgress(req: Request, res: Response) {
    try {
      const userId = (req as any).userId;
      const ids = await ProgressModel.getCompletedChapterIds(userId);
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
