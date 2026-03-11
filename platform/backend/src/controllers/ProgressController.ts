import { Request, Response } from 'express';
import { ProgressModel } from '../models/ProgressModel';

export class ProgressController {
  static async complete(req: Request, res: Response) {
    try {
      const { chapterId } = req.params;
      await ProgressModel.complete(req.user!.userId, chapterId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getMyProgress(req: Request, res: Response) {
    try {
      const ids = await ProgressModel.getCompletedChapterIds(req.user!.userId);
      res.json(ids);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
