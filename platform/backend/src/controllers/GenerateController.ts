import { Request, Response } from 'express';
import { AIService } from '../services/AIService';
import { QuotaService } from '../services/QuotaService';

const generatingSet = new Set<string>();

export class GenerateController {
  static progress(req: Request, res: Response) {
    const { chapterId } = req.params;
    const text = AIService.genProgress.get(chapterId) ?? null;
    res.json({ text, chars: text?.length ?? 0 });
  }

  static progressByKey(req: Request, res: Response) {
    const { key } = req.params;
    const text = AIService.genProgress.get(key) ?? null;
    res.json({ text, chars: text?.length ?? 0 });
  }

  static async generate(req: Request, res: Response) {
    try {
      const { storyId, chapterId } = req.params;
      const userId = (req as any).userId;

      if (generatingSet.has(chapterId)) {
        return res.status(409).json({ error: '该章节正在生成中，请勿重复提交 / Chapter is already being generated' });
      }

      // Check daily quota before anything else
      await QuotaService.check(userId);

      // Validate sequential constraint before responding
      await AIService.validateSequential(storyId, chapterId);
      generatingSet.add(chapterId);

      // Respond immediately, generation runs async
      res.json({ message: 'Generation started' });

      AIService.generateChapter(storyId, chapterId)
        .then(() => QuotaService.recordSuccess(userId, chapterId))
        .catch(err => {
          console.error('Generation error:', err.message);
        })
        .finally(() => {
          generatingSet.delete(chapterId);
        });
    } catch (err: any) {
      const status = err.code === 'QUOTA_EXCEEDED' ? 429 : 400;
      res.status(status).json({ error: err.message, code: err.code });
    }
  }
}
