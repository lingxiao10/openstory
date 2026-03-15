import { Request, Response } from 'express';
import { AIService } from '../services/AIService';

export class GenerateController {
  static progressByKey(req: Request, res: Response) {
    const { key } = req.params;
    const text = AIService.genProgress.get(key) ?? null;
    res.json({ text, chars: text?.length ?? 0 });
  }
}
