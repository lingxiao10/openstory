/**
 * StreamGameService — "边看边生成" 核心服务
 *
 * 流程:
 *  1. startSession: 创建 story+chapters in DB, 生成所有章节 outlines, 返回 storyId
 *  2. subscribeToSession: SSE 连接, 新客户端接入时 replay 已缓存事件
 *  3. generateAllChapters: 顺序生成每章 XML, 实时推送节点事件
 *
 * SSE 事件类型:
 *  outline      { chapters: [{num, zh, en}] }
 *  node         { chapter: number, node: GameNode }       ← mystery
 *  meta         { chapter: number, meta: GameMeta }       ← numeric 元数据
 *  chapter_done { chapter: number }
 *  chapter_error{ chapter: number, message: string }
 *  done         {}
 *  error        { message: string }
 *
 * 断线重连: eventLog 保留所有历史事件, 新订阅者立即 replay
 */

import { Response } from 'express';
import { v4 as uuid } from 'uuid';
import { StoryModel } from '../models/StoryModel';
import { AIService } from './AIService';
import { XmlStreamParser } from '../utils/XmlStreamParser';
import { logger } from '../logger';
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
  outline: Array<{ num: number; zh: string; en: string }>;
  currentChapter: number;
  totalChapters: number;
  generationDone: boolean;
  eventLog: SseEvent[];
  subscribers: Set<Response>;
  /** Timestamp after which idle sessions are cleaned up */
  expireAt: number;
}

// ─── Session store ─────────────────────────────────────────────────────────────

const sessions = new Map<string, StreamSession>();

// Periodically remove expired sessions (every 10 minutes)
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

  // ── 1. Create story + outline ──────────────────────────────────────────────

  static async startSession(opts: StreamCreateOptions): Promise<string> {
    const { userId, title, background, genre, chapterCount, playerName, aiModel } = opts;

    const storyId = uuid();
    const resolvedModel = aiModel || 'deepseek-v3-2-251201';

    // Create story record
    await StoryModel.create({
      id: storyId,
      user_id: userId,
      title_zh: title,
      title_en: title,      // will be translated lazily if needed
      background_zh: background,
      background_en: background,
      genre,
      status: 'draft',
      player_name: playerName || '',
      ai_model: resolvedModel,
    });

    // Build a minimal Story object for outline generation
    const story: Story = {
      id: storyId,
      user_id: userId,
      title_zh: title,
      title_en: title,
      background_zh: background,
      background_en: background,
      genre,
      status: 'draft',
      player_name: playerName || '',
      ai_model: resolvedModel,
      created_at: new Date(),
    };

    // Generate all outlines synchronously (needed before we can generate any chapter)
    logger.info(`[StreamGame] generating ${chapterCount} outlines for storyId=${storyId}`);
    const outlines = await AIService.generateStoryOutlines(story, chapterCount);

    // Persist chapters
    for (let i = 0; i < outlines.length; i++) {
      const chapId = uuid();
      await StoryModel.createChapter({
        id: chapId,
        story_id: storyId,
        chapter_num: i + 1,
        outline_zh: outlines[i].zh,
        outline_en: outlines[i].en,
        content_zh: '',
        content_en: '',
        content_json: null,
        is_generated: false,
        generating_at: null,
        published: false,
        published_at: null,
      });
    }

    // Build session
    const session: StreamSession = {
      storyId,
      genre,
      outline: outlines.map((o, i) => ({ num: i + 1, zh: o.zh, en: o.en })),
      currentChapter: 0,
      totalChapters: chapterCount,
      generationDone: false,
      eventLog: [],
      subscribers: new Set(),
      expireAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
    };
    sessions.set(storyId, session);

    // Start generation in background (no await)
    const chapters = await StoryModel.getChapters(storyId);
    StreamGameService.generateAllChapters(session, story, chapters).catch(err => {
      logger.error(`[StreamGame] generateAllChapters error: ${err.message}`);
    });

    return storyId;
  }

  // ── 2. SSE subscription ────────────────────────────────────────────────────

  static subscribeToSession(storyId: string, res: Response): boolean {
    const session = sessions.get(storyId);
    if (!session) return false;

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering
    res.flushHeaders();

    // Replay all past events for reconnecting clients
    for (const ev of session.eventLog) {
      writeSse(res, ev.event, ev.data);
    }

    session.subscribers.add(res);
    session.expireAt = Date.now() + 2 * 60 * 60 * 1000; // refresh TTL on reconnect

    // Heartbeat to keep proxies alive
    const heartbeat = setInterval(() => {
      if (res.writableEnded) { clearInterval(heartbeat); return; }
      try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);

    res.on('close', () => {
      clearInterval(heartbeat);
      session.subscribers.delete(res);
      logger.info(`[StreamGame] client disconnected storyId=${storyId}, remaining=${session.subscribers.size}`);
    });

    return true;
  }

  // ── 3. Broadcast + log ─────────────────────────────────────────────────────

  private static broadcast(session: StreamSession, event: string, data: object) {
    const ev: SseEvent = { event, data };
    session.eventLog.push(ev);
    for (const res of session.subscribers) {
      writeSse(res, event, data);
    }
  }

  // ── 4. Chapter retry ───────────────────────────────────────────────────────

  static async retryChapter(storyId: string, chapterNum: number): Promise<boolean> {
    const session = sessions.get(storyId);
    if (!session) return false;

    const story = await StoryModel.findById(storyId);
    if (!story) return false;
    const allChapters = await StoryModel.getChapters(storyId);
    const chapter = allChapters.find(c => c.chapter_num === chapterNum);
    if (!chapter) return false;

    StreamGameService.generateOneChapter(session, story, chapter, allChapters).catch(err => {
      StreamGameService.broadcast(session, 'chapter_error', {
        chapter: chapterNum,
        message: err.message,
      });
    });
    return true;
  }

  // ── 5. Generate all chapters sequentially ─────────────────────────────────

  private static async generateAllChapters(
    session: StreamSession,
    story: Story,
    chapters: Chapter[],
  ): Promise<void> {
    // Emit outline event first (before any chapter generation)
    StreamGameService.broadcast(session, 'outline', { chapters: session.outline });

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
        // Continue to next chapter — player may retry this one
      }
    }

    session.generationDone = true;
    StreamGameService.broadcast(session, 'done', {});
    logger.info(`[StreamGame] all chapters done storyId=${session.storyId}`);
  }

  // ── 6. Generate one chapter with streaming XML ─────────────────────────────

  private static async generateOneChapter(
    session: StreamSession,
    story: Story,
    chapter: Chapter,
    allChapters: Chapter[],
  ): Promise<void> {
    const { genre } = session;
    const chapterNum = chapter.chapter_num;
    const totalChapters = session.totalChapters;

    logger.info(`[StreamGame] generating chapter ${chapterNum}/${totalChapters} storyId=${story.id}`);

    // Mark as generating in DB
    await StoryModel.updateChapter(chapter.id, { generating_at: new Date() });

    // Build previous chapters context (same logic as AIService.generateChapter)
    const prevChapters = allChapters
      .filter(c => c.chapter_num < chapterNum && c.is_generated && c.content_json)
      .slice(-20);

    const prompt = genre === 'numeric'
      ? StreamGameService.buildNumericPrompt(story, chapter, prevChapters, chapterNum, totalChapters)
      : StreamGameService.buildMysteryPrompt(story, chapter, prevChapters, chapterNum, totalChapters);

    const aiModel = story.ai_model || 'deepseek-v3-2-251201';
    const maxTokens = genre === 'numeric' ? 18000 : 7000;

    const parser = new XmlStreamParser();
    const collectedNodes: any[] = [];
    let numericMeta: any | null = null;

    // Stream AI output through XML parser, broadcast each node as it arrives
    await AIService.callAI(
      prompt,
      getProvider(aiModel),
      maxTokens,
      aiModel,
      undefined, // no progressKey (we broadcast directly)
      (delta: string) => {
        const elements = parser.feed(delta);
        for (const el of elements) {
          if (el.kind === 'meta') {
            numericMeta = el.data;
            StreamGameService.broadcast(session, 'meta', {
              chapter: chapterNum,
              meta: el.data,
            });
          } else {
            // Ensure node has a sequential id
            const node = { ...el.data, id: collectedNodes.length };
            collectedNodes.push(node);
            StreamGameService.broadcast(session, 'node', {
              chapter: chapterNum,
              node,
            });
          }
        }
      }
    );

    // Flush any partial buffer at end of stream
    const remaining = parser.flush();
    for (const el of remaining) {
      if (el.kind === 'meta') {
        numericMeta = el.data;
        StreamGameService.broadcast(session, 'meta', { chapter: chapterNum, meta: el.data });
      } else {
        const node = { ...el.data, id: collectedNodes.length };
        collectedNodes.push(node);
        StreamGameService.broadcast(session, 'node', { chapter: chapterNum, node });
      }
    }

    // Ensure terminal node exists
    StreamGameService.ensureTerminalNode(collectedNodes, genre);

    // Save to DB in existing JSON format (compatible with normal game player)
    const contentJson = StreamGameService.toStoredJson(collectedNodes, numericMeta, genre);
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

  // ── 7. Ensure terminal node ────────────────────────────────────────────────

  private static ensureTerminalNode(nodes: any[], genre: 'mystery' | 'numeric') {
    if (nodes.length === 0) return;
    const last = nodes[nodes.length - 1];
    if (genre === 'numeric') {
      if (last.type !== 'end') {
        nodes.push({ id: nodes.length, type: 'end', text: { zh: '你完成了这一章的旅程。', en: 'You completed this chapter.' } });
      }
    } else {
      if (last.type !== 'victory' && last.type !== 'verdict') {
        nodes.push({ id: nodes.length, type: 'victory', act: { zh: '尾声', en: 'Epilogue' }, text: { zh: '故事告一段落。', en: 'The story draws to a close.' } });
      }
    }
  }

  // ── 8. Serialise to DB format ──────────────────────────────────────────────

  private static toStoredJson(nodes: any[], numericMeta: any | null, genre: string): string {
    let result: any;
    if (genre === 'numeric' && numericMeta) {
      result = { ...numericMeta, cards: nodes };
    } else {
      result = nodes;
    }
    return JSON.stringify(result).replace(/[\u0080-\uFFFF]/g, c =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  }

  // ── 9. Mystery prompt ──────────────────────────────────────────────────────

  private static buildMysteryPrompt(
    story: Story,
    chapter: Chapter,
    prevChapters: { chapter_num: number; outline_zh: string; content_json: string | null }[],
    chapterNum: number,
    totalChapters: number,
  ): string {
    let prevContext = '';
    if (prevChapters.length > 0) {
      const lines = prevChapters.map(c => {
        const text = c.content_json ? AIService.extractStoryText(c.content_json) : '';
        return `第${c.chapter_num}章（${c.outline_zh}）：${text}`;
      });
      prevContext = `\n前情摘要（保持故事连贯，人物/设定/情节接续以下内容）：\n${lines.join('\n')}\n`;
    }

    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是全书最后一章，必须给出完整的故事结局，彻底揭晓谜底并收束所有主线剧情。】`
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，不要有"最终"、"从此"等终结性描述，本章内容只推进情节，为后续章节铺垫。】`;

    const playerPrompt = story.player_name?.trim()
      ? `\n玩家控制的角色是：${story.player_name}，以第三人称（${story.player_name}）的视角来生成互动小说。`
      : '';

    // Full outlines of all chapters so AI has global story awareness
    const allOutlines = `\n全书章节大纲概览（用于保证整体一致性，不要超出范围）：\n${
      Array.from({ length: totalChapters }, (_, i) => `第${i + 1}章`).join('、')
    }（当前生成第${chapterNum}章）\n`;

    return `你是网文作者，负责生成互动小说。直接输出内容，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
当前章节：${chapterProgress}
本章大纲：${chapter.outline_zh}
${endingInstruction}${playerPrompt}${allOutlines}${prevContext}
内容范围要求（最重要，必须严格遵守）：
- 所有 story 节点和 choice 节点的内容，必须严格局限于【本章大纲】所描述的情节范围之内
- 不得写入大纲未提及的新人物、新地点、新事件
- choice 节点要自然穿插在叙事流程中，出现在情节发展的关键决策点，而非集中堆在末尾
- choice 的选项必须是大纲情节范围内合理存在的决策

写作风格要求（必须遵守）：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，不用书面语
- 叙事、对话、心理活动交替出现，节奏紧凑
- 文字中绝对禁止使用双引号（"），对话用单引号（'）代替
- 文字内容中禁止使用 XML 标签字符 < > &

输出格式（每个节点独占一行，用 XML 包裹 JSON，不要输出JSON数组，不要 \`\`\`json 标记）：
<node>{"id":0,"type":"story","act":{"zh":"第一幕 标题","en":"Act 1 · Title"},"text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":1,"type":"story","text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":5,"type":"choice","text":{"zh":"问题","en":"question"},"optA":{"zh":"...","en":"..."},"optB":{"zh":"...","en":"..."},"correct":"A","penalty":{"zh":"惩罚文本","en":"penalty"},"hint":{"zh":"提示","en":"hint"}}</node>
<node>{"id":27,"type":"victory","act":{"zh":"尾声","en":"Epilogue"},"text":{"zh":"结局文本","en":"ending text"}}</node>

规则：严格控制在 30 个节点以内，其中 3-4 个 choice 节点，最后一个节点必须是 victory 类型。

输出：`;
  }

  // ── 10. Numeric prompt ─────────────────────────────────────────────────────

  private static buildNumericPrompt(
    story: Story,
    chapter: Chapter,
    prevChapters: { chapter_num: number; outline_zh: string; content_json: string | null }[],
    chapterNum: number,
    totalChapters: number,
  ): string {
    let prevContext = '';
    if (prevChapters.length > 0) {
      const lines = prevChapters.map(c => {
        const text = c.content_json ? AIService.extractStoryText(c.content_json) : '';
        return `第${c.chapter_num}章（${c.outline_zh}）：${text}`;
      });
      prevContext = `\n前情摘要（保持故事连贯，人物/物资/数值状态接续以下内容）：\n${lines.join('\n')}\n`;
    }

    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是全书最后一章，必须给出完整的故事结局，彻底收束所有主线剧情。】`
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，本章内容只推进情节，为后续章节铺垫。】`;

    const playerPrompt = story.player_name?.trim()
      ? `\n玩家控制的角色是：${story.player_name}，以第三人称（${story.player_name}）的视角来生成互动小说。`
      : '';

    return `你是网文作者，负责生成数值型互动故事。直接输出内容，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
当前章节：${chapterProgress}
本章大纲：${chapter.outline_zh}
${endingInstruction}${playerPrompt}${prevContext}
内容范围要求（最重要）：
- 所有节点内容必须严格局限于【本章大纲】所描述的情节范围之内
- choice 节点要自然穿插，出现在关键决策点

写作风格要求：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，文字中绝对禁止使用双引号（"），对话用单引号（'）代替
- 文字内容中禁止使用 XML 标签字符 < > &

数值设计要求（重要）：
- 必须根据故事背景自行设计4个合适的属性
- 每个 choice 节点的 effects 中，非零值最多3个，数值要有增有减
- 关键时刻错误选择应有明显惩罚（-3到-4），迫使玩家认真权衡

输出格式（先输出元数据，再输出节点，不要JSON数组，不要 \`\`\`json 标记）：
<meta>{"title":{"zh":"章节标题","en":"Chapter Title"},"description":{"zh":"一句话简介","en":"one-line desc"},"statDefs":{"life":{"name":{"zh":"生命","en":"Life"},"icon":"❤️","color":"#ef4444","bg":"#7f1d1d"},"stamina":{"name":{"zh":"体力","en":"Stamina"},"icon":"⚡","color":"#f59e0b","bg":"#78350f"},"mood":{"name":{"zh":"心情","en":"Mood"},"icon":"😊","color":"#3b82f6","bg":"#1e3a5f"},"supplies":{"name":{"zh":"物资","en":"Supplies"},"icon":"🎒","color":"#22c55e","bg":"#14532d"}},"itemDefs":{},"winText":{"zh":"通关文本","en":"clear text"}}</meta>
<node>{"id":0,"type":"story","act":{"zh":"第一幕 标题","en":"Act 1 · Title"},"text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":1,"type":"story","text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":8,"type":"choice","text":{"zh":"你怎么做？","en":"What do you do?"},"choices":[{"label":{"zh":"选项A","en":"Option A"},"text":{"zh":"结果（2-3句）","en":"outcome"},"effects":{"life":0,"stamina":-2,"mood":1,"supplies":0}},{"label":{"zh":"选项B","en":"Option B"},"text":{"zh":"结果（2-3句）","en":"outcome"},"effects":{"life":-3,"stamina":0,"mood":0,"supplies":1}}]}</node>

规则：cards 共 60 个节点，其中 8-10 个 choice 节点，最后一个用 type:"end"。

输出：`;
  }

  // ── 11. Query session state (for client polling fallback) ──────────────────

  static getSessionInfo(storyId: string): { found: boolean; done: boolean; currentChapter: number } {
    const s = sessions.get(storyId);
    if (!s) return { found: false, done: false, currentChapter: 0 };
    return { found: true, done: s.generationDone, currentChapter: s.currentChapter };
  }
}
