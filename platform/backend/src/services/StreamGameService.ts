/**
 * StreamGameService — "边看边生成" 核心服务
 *
 * 流程:
 *  1. startSession: 创建 story+chapters in DB, 生成200字故事主线（~5s），立即返回 storyId
 *  2. 后台立刻开始生成第1章 XML 流，无需等待全部大纲
 *  3. subscribeToSession: SSE 连接, 新客户端接入时 replay 已缓存事件
 *
 * SSE 事件类型:
 *  outline      { chapters: [{num, zh, en}] }   ← 仅章节编号，无详细大纲
 *  node         { chapter: number, node: GameNode }
 *  meta         { chapter: number, meta: GameMeta }   ← numeric 元数据
 *  chapter_done { chapter: number }
 *  chapter_error{ chapter: number, message: string }
 *  done         {}
 *
 * 连贯性保证:
 *  - 每章 prompt 包含: 故事主线(spine) + 前章文本摘要
 *  - 不需要预生成所有章节大纲，极大缩短启动等待
 */

import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { StoryModel } from '../models/StoryModel';
import { AIService } from './AIService';
import { XmlStreamParser } from '../utils/XmlStreamParser';
import { PromptService } from './PromptService';
import { logger, promptLogger } from '../logger';
import { Story, Chapter } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamCreateOptions {
  userId: string;
  title: string;
  background: string;
  genre: 'mystery' | 'numeric';
  chapterCount: number;
  playerName?: string;
  aiModel?: string;
}

interface SseEvent {
  event: string;
  data: object;
}

interface StreamSession {
  storyId: string;
  genre: 'mystery' | 'numeric';
  spine: string;           // 200字故事主线，取代全章大纲
  totalChapters: number;
  currentChapter: number;
  generationDone: boolean;
  eventLog: SseEvent[];
  subscribers: Set<Response>;
  expireAt: number;
}

// ─── Session store ─────────────────────────────────────────────────────────────

const sessions = new Map<string, StreamSession>();

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now > s.expireAt && s.subscribers.size === 0) {
      sessions.delete(id);
      logger.info(`[StreamGame] session cleaned up storyId=${id}`);
    }
  }
}, 10 * 60 * 1000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProvider(model: string): 'ark' | 'openrouter' {
  return model.startsWith('google/') ? 'openrouter' : 'ark';
}

function writeSse(res: Response, event: string, data: object) {
  if (res.writableEnded) return;
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected */ }
}

// ─── StreamGameService ────────────────────────────────────────────────────────

export class StreamGameService {

  // ── 1a. 后台生成英文标题 + 中文摘要 ──────────────────────────────────────

  static async generateAndUpdateMeta(
    storyId: string,
    title: string,
    background: string,
    aiModel: string,
  ): Promise<void> {
    const prompt = `为以下互动小说生成英文标题、中文摘要和英文摘要。直接输出 JSON，不要任何说明。
故事标题：${title}
故事背景：${background}
输出格式：{"title_en":"English title","summary_zh":"20-30字中文摘要，吸引读者的一句话简介","summary_en":"One sentence English summary, 20-40 words, engaging"}`;
    const raw = await AIService.callAI(prompt, getProvider(aiModel), 300, aiModel);
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const titleEn = (parsed.title_en || title).slice(0, 200);
    const summaryZh = (parsed.summary_zh || '').slice(0, 200);
    const summaryEn = (parsed.summary_en || '').slice(0, 200);
    await StoryModel.updateMeta(storyId, titleEn, summaryZh, summaryEn);
    logger.info(`[StreamGame] meta updated storyId=${storyId} title_en="${titleEn}"`);
  }

  // ── 1. 生成200字故事主线（快速，替代全章大纲） ────────────────────────────

  private static async generateSpine(
    title: string,
    background: string,
    genre: string,
    chapterCount: number,
    playerName: string,
    aiModel: string,
  ): Promise<string> {
    const playerPrompt = playerName ? `玩家角色：${playerName}。` : '';
    const prompt = `你是故事策划，为以下互动小说生成200字以内的故事主线梗概，精炼描述整体走向、主要人物、核心冲突和结局方向。直接输出文字，不要任何格式标记。
标题：${title}
背景：${background}
共${chapterCount}章
${playerPrompt}
直接输出：`;
    const raw = await AIService.callAI(prompt, getProvider(aiModel), 500, aiModel);
    return raw.trim().slice(0, 600); // 最多600字符防止超长
  }

  // ── 2. 创建故事会话，立即返回 storyId ─────────────────────────────────────

  static async startSession(opts: StreamCreateOptions): Promise<string> {
    const { userId, title, background, genre, chapterCount, playerName, aiModel } = opts;

    const storyId = uuid();
    const resolvedModel = aiModel || 'deepseek-v3-2-251201';
    const resolvedPlayerName = playerName || '';

    // 创建 story 记录
    await StoryModel.create({
      id: storyId,
      user_id: userId,
      title_zh: title,
      title_en: title,
      background_zh: background,
      background_en: background,
      genre,
      status: 'draft',
      player_name: resolvedPlayerName,
      ai_model: resolvedModel,
    });

    // 生成故事主线（~5s，远快于全章大纲）
    logger.info(`[StreamGame] generating spine for storyId=${storyId}`);
    const spine = await StreamGameService.generateSpine(
      title, background, genre, chapterCount, resolvedPlayerName, resolvedModel
    );
    logger.info(`[StreamGame] spine done (${spine.length} chars)`);

    // 后台生成英文标题 + 中文摘要（fire-and-forget）
    StreamGameService.generateAndUpdateMeta(storyId, title, background, resolvedModel)
      .catch(err => logger.error(`[StreamGame] meta generation failed: ${err.message}`));

    // 创建章节占位记录
    const chapterIds: string[] = [];
    for (let i = 0; i < chapterCount; i++) {
      const chapId = uuid();
      chapterIds.push(chapId);
      await StoryModel.createChapter({
        id: chapId,
        story_id: storyId,
        chapter_num: i + 1,
        outline_zh: '',
        outline_en: '',
        content_zh: '',
        content_en: '',
        content_json: null,
        is_generated: false,
        generating_at: null,
        published: false,
        published_at: null,
      });
    }

    // 构建 story 对象（用于传给生成函数）
    const story: Story = {
      id: storyId,
      user_id: userId,
      title_zh: title,
      title_en: title,
      background_zh: background,
      background_en: background,
      genre,
      status: 'draft',
      player_name: resolvedPlayerName,
      ai_model: resolvedModel,
      created_at: new Date(),
    };

    // 建立 session
    const session: StreamSession = {
      storyId,
      genre,
      spine,
      currentChapter: 0,
      totalChapters: chapterCount,
      generationDone: false,
      eventLog: [],
      subscribers: new Set(),
      expireAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    sessions.set(storyId, session);

    // 后台立刻开始生成（不 await）
    const chapters = await StoryModel.getChapters(storyId);
    StreamGameService.generateAllChapters(session, story, chapters).catch(err => {
      logger.error(`[StreamGame] generateAllChapters error: ${err.message}`);
    });

    return storyId;
  }

  // ── 3. SSE 订阅 ───────────────────────────────────────────────────────────

  static subscribeToSession(storyId: string, res: Response): boolean {
    const session = sessions.get(storyId);
    if (!session) return false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // 重连时 replay 历史事件
    for (const ev of session.eventLog) {
      writeSse(res, ev.event, ev.data);
    }

    session.subscribers.add(res);
    session.expireAt = Date.now() + 2 * 60 * 60 * 1000;

    const heartbeat = setInterval(() => {
      if (res.writableEnded) { clearInterval(heartbeat); return; }
      try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeat);
      session.subscribers.delete(res);
    });

    return true;
  }

  // ── 4. 广播 + 记录 ────────────────────────────────────────────────────────

  private static broadcast(session: StreamSession, event: string, data: object) {
    const ev: SseEvent = { event, data };
    session.eventLog.push(ev);
    for (const res of session.subscribers) {
      writeSse(res, event, data);
    }
  }

  // ── 5. 章节重试 ───────────────────────────────────────────────────────────

  static async retryChapter(storyId: string, chapterNum: number): Promise<boolean> {
    const session = sessions.get(storyId);
    if (!session) return false;
    const story = await StoryModel.findById(storyId);
    if (!story) return false;
    const allChapters = await StoryModel.getChapters(storyId);
    const chapter = allChapters.find(c => c.chapter_num === chapterNum);
    if (!chapter) return false;

    StreamGameService.generateOneChapter(session, story, chapter, allChapters).catch(err => {
      StreamGameService.broadcast(session, 'chapter_error', { chapter: chapterNum, message: err.message });
    });
    return true;
  }

  // ── 6. 顺序生成所有章节 ───────────────────────────────────────────────────

  private static async generateAllChapters(
    session: StreamSession,
    story: Story,
    chapters: Chapter[],
  ): Promise<void> {
    // 立即广播章节编号列表（不含详细大纲）
    StreamGameService.broadcast(session, 'outline', {
      chapters: chapters.map(c => ({ num: c.chapter_num, zh: c.outline_zh || '', en: c.outline_en || '' })),
    });

    for (const chapter of chapters) {
      session.currentChapter = chapter.chapter_num;
      try {
        await StreamGameService.generateOneChapter(session, story, chapter, chapters);
      } catch (err: any) {
        logger.error(`[StreamGame] chapter ${chapter.chapter_num} failed: ${err.message}`);
        StreamGameService.broadcast(session, 'chapter_error', {
          chapter: chapter.chapter_num,
          message: err.message,
        });
        // 继续生成下一章，不中断整个流程
      }
    }

    session.generationDone = true;
    StreamGameService.broadcast(session, 'done', {});
    logger.info(`[StreamGame] all chapters done storyId=${session.storyId}`);
  }

  // ── 7. 生成单章 XML 流 ────────────────────────────────────────────────────

  private static async generateOneChapter(
    session: StreamSession,
    story: Story,
    chapter: Chapter,
    allChapters: Chapter[],
  ): Promise<void> {
    const { genre } = session;
    const chapterNum = chapter.chapter_num;
    const totalChapters = session.totalChapters;

    logger.info(`[StreamGame] generating chapter ${chapterNum}/${totalChapters}`);
    await StoryModel.updateChapter(chapter.id, { generating_at: new Date() });

    // 前章文本摘要（保证连贯性）
    const prevChapters = allChapters
      .filter(c => c.chapter_num < chapterNum && c.is_generated && c.content_json)
      .slice(-10);

    const prompt = genre === 'numeric'
      ? StreamGameService.buildNumericPrompt(session.spine, story, prevChapters, chapterNum, totalChapters)
      : StreamGameService.buildMysteryPrompt(session.spine, story, prevChapters, chapterNum, totalChapters);


    const logFile = promptLogger.write(genre, chapterNum, prompt);
    if (logFile) logger.info(`[StreamGame] prompt logged to ${logFile}`);

    const aiModel = story.ai_model || 'deepseek-v3-2-251201';
    const maxTokens = genre === 'numeric' ? 18000 : 7000;

    const parser = new XmlStreamParser();
    const collectedNodes: any[] = [];
    let numericMeta: any | null = null;

    await AIService.callAI(
      prompt,
      getProvider(aiModel),
      maxTokens,
      aiModel,
      undefined,
      (delta: string) => {
        const elements = parser.feed(delta);
        for (const el of elements) {
          if (el.kind === 'meta') {
            numericMeta = el.data;
            StreamGameService.broadcast(session, 'meta', { chapter: chapterNum, meta: el.data });
          } else {
            const node = { ...el.data, id: collectedNodes.length };
            collectedNodes.push(node);
            StreamGameService.broadcast(session, 'node', { chapter: chapterNum, node });
          }
        }
      }
    );

    // flush 剩余 buffer
    for (const el of parser.flush()) {
      if (el.kind === 'meta') {
        numericMeta = el.data;
        StreamGameService.broadcast(session, 'meta', { chapter: chapterNum, meta: el.data });
      } else {
        const node = { ...el.data, id: collectedNodes.length };
        collectedNodes.push(node);
        StreamGameService.broadcast(session, 'node', { chapter: chapterNum, node });
      }
    }

    // 补全终止节点
    StreamGameService.ensureTerminalNode(collectedNodes, genre);

    // 存入 DB（与普通生成兼容的格式）
    const contentJson = genre === 'numeric' && numericMeta
      ? JSON.stringify({ ...numericMeta, cards: collectedNodes })
      : JSON.stringify(collectedNodes);

    await StoryModel.updateChapter(chapter.id, {
      content_zh: genre === 'numeric' ? '数值故事已生成' : '互动小说已生成',
      content_en: genre === 'numeric' ? 'Numeric story generated' : 'Interactive story generated',
      content_json: contentJson,
      is_generated: true,
      generating_at: null,
    });

    StreamGameService.broadcast(session, 'chapter_done', { chapter: chapterNum });
    logger.info(`[StreamGame] chapter ${chapterNum} done, nodes=${collectedNodes.length}`);
  }

  // ── 8. 补全终止节点 ───────────────────────────────────────────────────────

  private static ensureTerminalNode(nodes: any[], genre: 'mystery' | 'numeric') {
    if (nodes.length === 0) return;
    const last = nodes[nodes.length - 1];
    if (genre === 'numeric') {
      if (last.type !== 'end') nodes.push({ id: nodes.length, type: 'end', text: { zh: '你完成了这一章的旅程。', en: 'You completed this chapter.' } });
    } else {
      if (last.type !== 'victory' && last.type !== 'verdict') {
        nodes.push({ id: nodes.length, type: 'victory', act: { zh: '尾声', en: 'Epilogue' }, text: { zh: '故事告一段落。', en: 'The story draws to a close.' } });
      }
    }
  }

  // ── 9. 推理解谜 prompt（委托给 PromptService）────────────────────────────

  private static buildMysteryPrompt(
    spine: string,
    story: Story,
    prevChapters: { chapter_num: number; content_json: string | null }[],
    chapterNum: number,
    totalChapters: number,
  ): string {
    let prevContext = '';
    if (prevChapters.length > 0) {
      const lines = prevChapters.map(c => {
        const text = c.content_json ? AIService.extractStoryText(c.content_json) : '';
        return `第${c.chapter_num}章全文：\n${text}`;
      });
      prevContext = `\n前情全文（极其重要：本章开篇必须从第${prevChapters[prevChapters.length - 1].chapter_num}章结尾直接续写，不得重新介绍已有人物，不得重复已发生情节）：\n${lines.join('\n\n')}\n`;
    }
    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是最后一章，必须给出完整结局，彻底收束所有主线剧情。】`
      : `【本章不是最后一章，结尾留有悬念，为后续章节铺垫，绝对不要终结故事。】`;
    const playerPrompt = story.player_name?.trim()
      ? `\n玩家角色：${story.player_name}，以第三人称视角面对所有决策。`
      : '';
    const firstChapterInstruction = chapterNum === 1
      ? '第一章特别要求：开篇用3-5个 story 节点进行世界观和背景铺垫，让读者充分了解故事背景后再进入正式情节。\n'
      : '';
    return PromptService.buildMysteryPrompt({
      title: story.title_zh,
      background: story.background_zh,
      chapterProgress,
      outline: `故事主线：${spine}`,
      endingInstruction,
      playerPrompt,
      prevContext,
      firstChapterInstruction,
    });
  }

  // ── 10. 数值冒险 prompt（委托给 PromptService）───────────────────────────

  private static buildNumericPrompt(
    spine: string,
    story: Story,
    prevChapters: { chapter_num: number; content_json: string | null }[],
    chapterNum: number,
    totalChapters: number,
  ): string {
    let prevContext = '';
    if (prevChapters.length > 0) {
      const lines = prevChapters.map(c => {
        const text = c.content_json ? AIService.extractStoryText(c.content_json) : '';
        return `第${c.chapter_num}章全文：\n${text}`;
      });
      prevContext = `\n前情全文（极其重要：本章开篇必须从第${prevChapters[prevChapters.length - 1].chapter_num}章结尾直接续写，不得重新介绍已有人物，不得重复已发生情节，数值/物资状态接续上章）：\n${lines.join('\n\n')}\n`;
    }
    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是全书最后一章，必须给出完整的故事结局，彻底收束所有主线剧情。】`
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，不要有"最终"、"从此"等终结性描述，本章内容只推进情节，为后续章节铺垫。】`;
    const playerPrompt = story.player_name?.trim()
      ? `\n玩家控制的角色是：${story.player_name}，以第三人称（${story.player_name}）的视角来生成互动小说，注意，所有的选择决定都以玩家角色视角来面对和决定的。`
      : '';
    const firstChapterInstruction = chapterNum === 1
      ? '第一章特别要求：开篇用3-5个 story 节点进行世界观和背景铺垫，让读者充分了解故事背景后再进入正式情节。\n'
      : '';
    return PromptService.buildNumericPrompt({
      title: story.title_zh,
      background: story.background_zh,
      chapterProgress,
      outline: `故事主线：${spine}`,
      endingInstruction,
      playerPrompt,
      prevContext,
      firstChapterInstruction,
    });
  }

  // ── 11. 恢复已存在故事的会话 ────────────────────────────────────────────────

  static async resumeSession(storyId: string, story: Story): Promise<void> {
    logger.info(`[StreamGame] resuming session for storyId=${storyId}`);

    // 检查是否已有会话
    if (sessions.has(storyId)) {
      logger.info(`[StreamGame] session already exists for storyId=${storyId}`);
      return;
    }

    // 获取章节
    const chapters = await StoryModel.getChapters(storyId);
    const chapterCount = chapters.length;

    // 生成spine（如果没有的话，使用故事背景）
    const spine = story.background_zh || '故事主线';

    // 建立session
    const session: StreamSession = {
      storyId,
      genre: story.genre as 'mystery' | 'numeric',
      spine,
      currentChapter: 0,
      totalChapters: chapterCount,
      generationDone: false,
      eventLog: [],
      subscribers: new Set(),
      expireAt: Date.now() + 2 * 60 * 60 * 1000,
    };
    sessions.set(storyId, session);

    // 检查是否所有章节都已生成
    const allGenerated = chapters.every(c => c.is_generated && c.content_json);

    if (allGenerated) {
      // 所有章节已生成，直接发送已有数据
      logger.info(`[StreamGame] all chapters already generated, sending existing data`);
      StreamGameService.sendExistingData(session, story, chapters);
    } else {
      // 有未生成的章节，继续生成
      logger.info(`[StreamGame] some chapters not generated, starting generation`);
      StreamGameService.generateAllChapters(session, story, chapters).catch(err => {
        logger.error(`[StreamGame] generateAllChapters error: ${err.message}`);
      });
    }
  }

  // ── 11.5. 发送已存在的数据 ──────────────────────────────────────────────────

  private static sendExistingData(session: StreamSession, story: Story, chapters: Chapter[]) {
    const { genre } = session;

    // 发送outline事件
    const outlineData = {
      chapters: chapters.map(c => ({
        num: c.chapter_num,
        zh: c.outline_zh || '',
        en: c.outline_en || '',
      })),
    };
    StreamGameService.broadcast(session, 'outline', outlineData);

    // 发送每个章节的数据
    for (const chapter of chapters) {
      if (!chapter.content_json) continue;

      try {
        const data = JSON.parse(chapter.content_json);

        if (genre === 'numeric') {
          // 发送meta
          const meta = {
            title: data.title,
            description: data.description,
            statDefs: data.statDefs,
            itemDefs: data.itemDefs,
            winText: data.winText,
          };
          StreamGameService.broadcast(session, 'meta', { chapter: chapter.chapter_num, meta });

          // 发送nodes
          const cards = data.cards || [];
          for (const card of cards) {
            StreamGameService.broadcast(session, 'node', { chapter: chapter.chapter_num, node: card });
          }
        } else {
          // mystery模式，直接发送nodes
          const nodes = Array.isArray(data) ? data : [];
          for (const node of nodes) {
            StreamGameService.broadcast(session, 'node', { chapter: chapter.chapter_num, node });
          }
        }

        // 发送chapter_done
        StreamGameService.broadcast(session, 'chapter_done', { chapter: chapter.chapter_num });
      } catch (err: any) {
        logger.error(`[StreamGame] failed to parse chapter ${chapter.chapter_num}: ${err.message}`);
      }
    }

    // 发送done事件
    session.generationDone = true;
    StreamGameService.broadcast(session, 'done', {});
    logger.info(`[StreamGame] existing data sent for storyId=${session.storyId}`);
  }

  // ── 12. 会话状态查询 ──────────────────────────────────────────────────────

  static getSessionInfo(storyId: string): { found: boolean; done: boolean; currentChapter: number } {
    const s = sessions.get(storyId);
    if (!s) return { found: false, done: false, currentChapter: 0 };
    return { found: true, done: s.generationDone, currentChapter: s.currentChapter };
  }
}
