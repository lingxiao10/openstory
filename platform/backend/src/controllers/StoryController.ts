import { Request, Response } from 'express';
import { StoryService } from '../services/StoryService';

export class StoryController {
  static async create(req: Request, res: Response) {
    try {
      const { title, genre, background } = req.body;
      if (!title || !genre) return res.status(400).json({ error: 'Missing required fields' });
      const id = await StoryService.createStory(req.user!.userId, title, genre, background || '');
      res.status(201).json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const stories = await StoryService.getUserStories(req.user!.userId);
      res.json(stories);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const story = await StoryService.getStory(req.params.id, req.user!.userId);
      res.json(story);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  }

  static async addChapter(req: Request, res: Response) {
    try {
      const { outline } = req.body;
      if (!outline) return res.status(400).json({ error: 'Missing outline' });
      const id = await StoryService.addChapter(req.params.id, req.user!.userId, outline);
      res.status(201).json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async deleteChapter(req: Request, res: Response) {
    try {
      await StoryService.deleteChapter(req.params.id, req.params.chapterId, req.user!.userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  static async publishChapter(req: Request, res: Response) {
    try {
      await StoryService.publishChapter(req.params.id, req.params.chapterId, req.user!.userId);
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
