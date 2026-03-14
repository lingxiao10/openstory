import { Request, Response } from 'express';
import { StreamGameService, StreamCreateOptions } from '../services/StreamGameService';
import { logger } from '../logger';

const activeStarts = new Set<string>(); // userId deduplicate

export class StreamGameController {

  /** POST /api/stream-game/start — create story + outlines, return storyId */
  static async start(req: Request, res: Response) {
    const userId = req.user!.userId;

    if (activeStarts.has(userId)) {
      return res.status(409).json({ error: '您已有一个故事正在初始化，请稍候' });
    }
    activeStarts.add(userId);

    try {
      const { title, background, genre, chapterCount, playerName, aiModel } = req.body;

      if (!title?.trim() || !background?.trim()) {
        return res.status(400).json({ error: '标题和背景不能为空' });
      }
      if (!['mystery', 'numeric'].includes(genre)) {
        return res.status(400).json({ error: '无效的 genre' });
      }
      const count = Math.min(Math.max(parseInt(chapterCount) || 1, 1), 5);

      const opts: StreamCreateOptions = {
        userId,
        title: title.trim(),
        background: background.trim(),
        genre,
        chapterCount: count,
        playerName: playerName?.trim() || '',
        aiModel: aiModel || 'deepseek-v3-2-251201',
      };

      const storyId = await StreamGameService.startSession(opts);
      res.json({ storyId });
    } catch (err: any) {
      logger.error(`[StreamGame] start error: ${err.message}`);
      res.status(500).json({ error: err.message });
    } finally {
      activeStarts.delete(userId);
    }
  }

  /** GET /api/stream-game/:storyId/events?token=... — SSE stream */
  static events(req: Request, res: Response) {
    const { storyId } = req.params;

    // Disable Express default timeout for SSE connections
    req.setTimeout(0);
    res.setTimeout(0);

    const found = StreamGameService.subscribeToSession(storyId, res);
    if (!found) {
      res.status(404).json({ error: '该流式游戏会话不存在或已过期' });
    }
  }

  /** POST /api/stream-game/:storyId/retry/:chapterNum — retry a failed chapter */
  static async retry(req: Request, res: Response) {
    const { storyId, chapterNum } = req.params;
    const num = parseInt(chapterNum);
    if (isNaN(num)) return res.status(400).json({ error: '无效的章节号' });

    const ok = await StreamGameService.retryChapter(storyId, num);
    if (!ok) return res.status(404).json({ error: '会话不存在或章节不存在' });
    res.json({ message: '重新生成已开始' });
  }

  /** GET /api/stream-game/:storyId/status — lightweight polling fallback */
  static status(req: Request, res: Response) {
    const { storyId } = req.params;
    res.json(StreamGameService.getSessionInfo(storyId));
  }
}
