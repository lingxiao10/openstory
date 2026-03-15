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
    const genreLabel = genre === 'numeric' ? '数值冒险' : '推理解谜';
    const prompt = `你是故事策划，为以下互动小说生成200字以内的故事主线梗概，精炼描述整体走向、主要人物、核心冲突和结局方向。直接输出文字，不要任何格式标记。
标题：${title}
背景：${background}
类型：${genreLabel}，共${chapterCount}章
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

    // 创建章节占位记录
    const chapterIds: string[] = [];
    for (let i = 0; i < chapterCount; i++) {
      const chapId = uuid();
      chapterIds.push(chapId);
      await StoryModel.createChapter({
        id: chapId,
        story_id: storyId,
        chapter_num: i + 1,
        outline_zh: `第${i + 1}章`,
        outline_en: `Chapter ${i + 1}`,
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
      chapters: chapters.map(c => ({ num: c.chapter_num, zh: `第${c.chapter_num}章`, en: `Chapter ${c.chapter_num}` })),
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
      .slice(-3); // 最多取3章前情

    const prompt = genre === 'numeric'
      ? StreamGameService.buildNumericPrompt(session.spine, story, prevChapters, chapterNum, totalChapters)
      : StreamGameService.buildMysteryPrompt(session.spine, story, prevChapters, chapterNum, totalChapters);

    // 记录提示词到文件
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `prompt_${genre}_ch${chapterNum}_${Date.now()}.txt`);
    fs.writeFileSync(logFile, prompt, 'utf-8');
    logger.info(`[StreamGame] prompt logged to ${logFile}`);

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

  // ── 9. 推理解谜 prompt ────────────────────────────────────────────────────

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
        return `第${c.chapter_num}章：${text.slice(0, 300)}`;
      });
      prevContext = `\n前情摘要（保持故事连贯，人物/设定/情节接续以下内容）：\n${lines.join('\n')}\n`;
    }

    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是最后一章，必须揭晓谜底，给出完整结局。】`
      : `【本章不是最后一章，结尾留有悬念，为后续章节铺垫，绝对不要终结故事。】`;

    const playerPrompt = story.player_name?.trim()
      ? `\n玩家角色：${story.player_name}，以第三人称视角面对所有决策。`
      : '';

    return `你是网文作者，负责生成互动小说。直接输出内容，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
故事主线：${spine}
当前：${chapterProgress}
${endingInstruction}${playerPrompt}${prevContext}
写作风格：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，叙事/对话/心理活动交替，节奏紧凑
- 文字中禁止使用双引号（"），对话用单引号（'）
- 文字内容中禁止使用 XML 标签字符 < > &

输出格式（每个节点独占一行，XML包裹JSON，不要JSON数组，不要 \`\`\`json）：
<node>{"id":0,"type":"story","act":{"zh":"第一幕 标题","en":"Act 1 · Title"},"text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":1,"type":"story","text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":5,"type":"choice","text":{"zh":"问题","en":"question"},"optA":{"zh":"...","en":"..."},"optB":{"zh":"...","en":"..."},"correct":"A","penalty":{"zh":"惩罚文本","en":"penalty"},"hint":{"zh":"提示","en":"hint"}}</node>
<node>{"id":27,"type":"victory","act":{"zh":"尾声","en":"Epilogue"},"text":{"zh":"结局","en":"ending"}}</node>

规则：30个节点以内，3-4个choice节点，最后一个节点必须是 victory 类型。

输出：`;
  }

  // ── 10. 数值冒险 prompt ───────────────────────────────────────────────────

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
        return `第${c.chapter_num}章：${text.slice(0, 300)}`;
      });
      prevContext = `\n前情摘要（保持故事连贯，人物/物资/数值状态接续以下内容）：\n${lines.join('\n')}\n`;
    }

    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是全书最后一章，必须给出完整的故事结局，彻底收束所有主线剧情。】`
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，不要有"最终"、"从此"等终结性描述，本章内容只推进情节，为后续章节铺垫。】`;

    const playerPrompt = story.player_name?.trim()
      ? `\n玩家控制的角色是：${story.player_name}，以第三人称（${story.player_name}）的视角来生成互动小说，注意，所有的选择决定都以玩家角色视角来面对和决定的。`
      : '';

    return `你是网文作者，负责生成数值型互动故事 JSON。直接输出 JSON，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
故事主线：${spine}
当前章节：${chapterProgress}
${endingInstruction}${playerPrompt}${prevContext}
内容范围要求（最重要，必须严格遵守）：
- 所有 story 节点和 choice 节点的内容，必须严格局限于【故事主线】所描述的情节范围之内
- 不得写入主线未提及的新人物、新地点、新事件
- choice 节点要自然穿插在叙事流程中，出现在情节发展的关键决策点，而非集中堆在末尾
- choice 的选项必须是主线情节范围内合理存在的决策，不得凭空引入主线之外的内容

写作风格要求（必须遵守）：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，不用书面语
- 叙事、对话、心理活动交替出现，节奏紧凑
- 文字中绝对禁止使用双引号（"），对话用单引号（'）代替
- choice 的结果文本必须清晰体现数值变化的原因：例如"疲倦"对应体力下降，"振奋"对应心情上升，"受伤"对应生命下降，让玩家一看就明白为什么数值会这样变化

数值设计要求（非常重要，必须严格遵守）：
- 必须根据故事背景自行设计4个合适的属性，使数值系统与故事主题高度契合
- 推荐两套参考方案（也可完全自定义）：
  方案A（探险/生存）：life生命、stamina体力、mood心情、supplies物资
  方案B（冒险/商旅）：life生命、stamina体力、mood心情、gold金币
  自定义举例：如武侠故事可用 life生命/inner内力/honor声望/bond缘分；空间故事可用 life生命/oxygen氧气/power电力/morale士气
- 数值范围：所有属性初始值为7，最大值为14，最小值为0（归零=死亡）
- 每个 choice 节点的 effects 中，非零值最多3个（通常2-3个），不要4个全改
- 数值变化必须有增有减（即"数值交换"），例如体力-2同时心情+1，而非全部减少或全部增加；绝大多数选择都应该是有得有失的权衡，极少出现全加或全减的情况
- 8-10个 choice 节点要均匀覆盖4种属性，不能总是只围绕某几个属性；每种属性至少被2个不同choice节点涉及
- 设计要有挑战性：关键时刻的错误选择应有明显惩罚（生命-3到-4），迫使玩家认真权衡
- effects 字段必须包含所有4个键（与你定义的statDefs键名一致，不影响的设为0）

输出格式（先meta后节点，不要JSON数组，不要 \`\`\`json）：
<meta>{"title":{"zh":"章节标题","en":"Chapter Title"},"description":{"zh":"简介","en":"desc"},"statDefs":{"life":{"name":{"zh":"生命","en":"Life"},"icon":"❤️","color":"#ef4444","bg":"#7f1d1d"},"stamina":{"name":{"zh":"体力","en":"Stamina"},"icon":"⚡","color":"#f59e0b","bg":"#78350f"},"mood":{"name":{"zh":"心情","en":"Mood"},"icon":"😊","color":"#3b82f6","bg":"#1e3a5f"},"supplies":{"name":{"zh":"物资","en":"Supplies"},"icon":"🎒","color":"#22c55e","bg":"#14532d"}},"itemDefs":{},"winText":{"zh":"通关文本","en":"clear text"}}</meta>
<node>{"id":0,"type":"story","act":{"zh":"第一幕 标题","en":"Act 1 · Title"},"text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":8,"type":"choice","text":{"zh":"你怎么做？","en":"What do you do?"},"choices":[{"label":{"zh":"选项A","en":"Option A"},"text":{"zh":"结果描述（2-3句）","en":"outcome"},"effects":{"life":0,"stamina":-2,"mood":1,"supplies":0}},{"label":{"zh":"选项B","en":"Option B"},"text":{"zh":"结果描述（2-3句）","en":"outcome"},"effects":{"life":-3,"stamina":0,"mood":0,"supplies":1}}]}</node>

规则：
- 共 60 个节点，其中 8-10 个 choice 节点，story 节点约 49-51 个，最后1个 end 节点
- 每个 choice 必须有 2 个选项（choices 数组长度=2）
- effects 必须包含所有4个数值键（与statDefs键名完全一致），不影响的设为0；非零值最多3个
- 生命归零=死亡，关键节点可扣3-4点，普通节点扣1-2点
- itemDefs 只定义本章会出现的道具（0-4个）
- statDefs 必须恰好4个属性，键名用英文小写，根据故事主题自行设计（不必照搬示例）
- 最后一个节点用 type:"end"，text 写通关文本

输出：`;
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

    // 后台开始生成
    StreamGameService.generateAllChapters(session, story, chapters).catch(err => {
      logger.error(`[StreamGame] generateAllChapters error: ${err.message}`);
    });
  }

  // ── 12. 会话状态查询 ──────────────────────────────────────────────────────

  static getSessionInfo(storyId: string): { found: boolean; done: boolean; currentChapter: number } {
    const s = sessions.get(storyId);
    if (!s) return { found: false, done: false, currentChapter: 0 };
    return { found: true, done: s.generationDone, currentChapter: s.currentChapter };
  }
}
