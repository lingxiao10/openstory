import { Request, Response } from 'express';
import { AIService } from '../services/AIService';

export class GenerateController {
  static async generate(req: Request, res: Response) {
    try {
      const { storyId, chapterId } = req.params;
      // Validate sequential constraint before responding
      await AIService.validateSequential(storyId, chapterId);
      // Respond immediately, generation runs async
      res.json({ message: 'Generation started' });
      AIService.generateChapter(storyId, chapterId).catch(err => {
        console.error('Generation error:', err.message);
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
}
