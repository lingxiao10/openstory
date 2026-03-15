import { Request, Response } from 'express';
import { StoryService } from '../services/StoryService';
import { AuthService } from '../services/AuthService';
import { isAdmin } from '../utils/isAdmin';
import { StoryModel } from '../models/StoryModel';
import { StreamGameService } from '../services/StreamGameService';
import { logger } from '../logger';

const creatingSet = new Set<string>();
// Tracks story IDs currently having meta regenerated (prevents duplicate work)
const metaRegenSet = new Set<string>();

async function refreshMissingMeta(): Promise<void> {
  const stories = await StoryModel.getPublicStoriesNeedingMeta();
  for (const s of stories) {
    if (metaRegenSet.has(s.id)) continue;
    metaRegenSet.add(s.id);
    StreamGameService.generateAndUpdateMeta(s.id, s.title_zh, s.background_zh || '', s.ai_model || 'deepseek-v3-2-251201')
      .catch(err => logger.error(`[meta regen] failed for ${s.id}: ${err.message}`))
      .finally(() => metaRegenSet.delete(s.id));
  }
}

export class StoryController {
  static async create(req: Request, res: Response) {
    const userId = (req as any).userId;
    if (creatingSet.has(userId)) {
      return res.status(409).json({ error: '正在创建中，请勿重复提交 / Already creating, please wait' });
    }
    creatingSet.add(userId);
    try {
      const { title, genre, background, chapterCount, progressKey, playerName, aiModel } = req.body;
      if (!title || !genre) return res.status(400).json({ error: 'Missing required fields' });

      const model = aiModel || 'deepseek-v3-2-251201';
      if (model.startsWith('google/gemini')) {
        const user = await AuthService.getUserById(userId);
        if (!user || !isAdmin(user.email, user.username)) {
          return res.status(403).json({ error: 'Only admins can use Gemini models / 只有管理员可以使用 Gemini 模型' });
        }
      }

      const count = typeof chapterCount === 'number' ? chapterCount : 0;
      const id = await StoryService.createStory(userId, title, genre, background || '', count, progressKey || undefined, playerName || '', model);
      res.status(201).json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    } finally {
      creatingSet.delete(userId);
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const stories = await StoryService.getUserStories((req as any).userId);
      res.json(stories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const story = await StoryService.getStory(req.params.id, (req as any).userId);
      res.json(story);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }

  static async addChapter(req: Request, res: Response) {
    try {
      const { outline } = req.body;
      if (!outline) return res.status(400).json({ error: 'Missing outline' });
      const id = await StoryService.addChapter(req.params.id, (req as any).userId, outline);
      res.status(201).json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async updateChapterOutline(req: Request, res: Response) {
    try {
      const { outline } = req.body;
      if (!outline) return res.status(400).json({ error: 'Missing outline' });
      await StoryService.updateChapterOutline(req.params.id, req.params.chapterId, (req as any).userId, outline);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async deleteChapter(req: Request, res: Response) {
    try {
      await StoryService.deleteChapter(req.params.id, req.params.chapterId, (req as any).userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async deleteStory(req: Request, res: Response) {
    try {
      const result = await StoryService.deleteStory(req.params.id, (req as any).userId);
      res.json({ ok: true, publishedCount: result.publishedCount });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async publishChapter(req: Request, res: Response) {
    try {
      await StoryService.publishChapter(req.params.id, req.params.chapterId, (req as any).userId);
      res.json({ ok: true });
    } catch (err: any) {
      const code = err.message === 'Previous chapter must be published first' ? 'PREV_CHAPTER_NOT_PUBLISHED' : undefined;
      res.status(400).json({ error: err.message, code });
    }
  }

  static async unpublishChapter(req: Request, res: Response) {
    try {
      await StoryService.unpublishChapter(req.params.id, req.params.chapterId, (req as any).userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  // Public: list stories with published chapters
  static async listPublic(_req: Request, res: Response) {
    try {
      const stories = await StoryService.getPublicStories();
      res.json(stories);
      // Background: fill in missing title_en / summary_en for any story that lacks them
      refreshMissingMeta().catch(() => {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Public: get a story's published chapters
  static async getPublic(req: Request, res: Response) {
    try {
      const story = await StoryService.getPublicStory(req.params.id);
      res.json(story);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }
}
