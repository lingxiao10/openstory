import { config } from '../config';
import { StoryModel } from '../models/StoryModel';
import { Story } from '../types';
import { ArkClient } from '../libs/ark/ArkClient';
import { logger, createStreamLogger } from '../logger';

/**
 * 修复 JSON 字符串内部的裸双引号（AI 常见问题）
 * 逐字符扫描，对字符串内出现的、不像是关闭引号的 " 加反斜杠转义
 */
function fixJson(s: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\') { out += c; esc = true; continue; }
    if (c === '"') {
      if (!inStr) { inStr = true; out += c; continue; }
      // 判断是否为合法的关闭引号：后面紧跟空白后是 : , } ] 或结束
      let j = i + 1;
      while (j < s.length && ' \t\n\r'.includes(s[j])) j++;
      const next = s[j];
      if (!next || ':,}]'.includes(next)) { inStr = false; out += c; }
      else { out += '\\"'; }
      continue;
    }
    out += c;
  }
  return out;
}

const GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class AIService {
  /** 当前正在生成的章节流式文本，key=chapterId */
  static readonly genProgress = new Map<string, string>();

  /** Check sequential constraint (throws if violated). Called before responding to client. */
  static async validateSequential(storyId: string, chapterId: string): Promise<void> {
    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.published) throw new Error('Cannot regenerate a published chapter');
    if (chapter.generating_at) {
      const elapsed = Date.now() - new Date(chapter.generating_at).getTime();
      if (elapsed < GENERATE_TIMEOUT_MS) {
        throw new Error('该章节正在生成中，请稍候 / Chapter is already being generated');
      }
      // Timed out — clear stale flag so generation can restart
      await StoryModel.updateChapter(chapterId, { generating_at: null });
    }
    if (chapter.chapter_num > 1) {
      const allChapters = await StoryModel.getChapters(storyId);
      const prev = allChapters.find(c => c.chapter_num === chapter.chapter_num - 1);
      if (!prev || !prev.is_generated) {
        throw new Error(
          `第 ${chapter.chapter_num - 1} 章尚未生成，请先生成上一章 / Chapter ${chapter.chapter_num - 1} must be generated first`
        );
      }
    }
  }

  static async generateChapter(storyId: string, chapterId: string): Promise<void> {
    const t0 = Date.now();
    logger.info(`[Generate] START storyId=${storyId} chapterId=${chapterId}`);

    const [chapter, story, allChapters] = await Promise.all([
      StoryModel.findChapterById(chapterId),
      StoryModel.findById(storyId),
      StoryModel.getChapters(storyId),
    ]);
    if (!chapter) throw new Error('Chapter not found');
    if (!story) throw new Error('Story not found');
    if (chapter.published) throw new Error('Cannot regenerate a published chapter');

    logger.info(`[Generate] chapter=${chapter.chapter_num} genre=${story.genre} outline="${chapter.outline_zh}"`);

    // 取当前章之前最多 20 章已生成的内容，作为前情上下文
    const prevChapters = allChapters
      .filter(c => c.chapter_num < chapter.chapter_num && c.is_generated && c.content_json)
      .slice(-20);

    logger.info(`[Generate] prevChapters count=${prevChapters.length}`);

    await StoryModel.updateChapter(chapterId, {
      content_zh: '生成中...',
      content_en: 'Generating...',
      is_generated: false,
      generating_at: new Date(),
    });

    try {
      logger.info(`[Generate] calling AI (genre=${story.genre})...`);
      const t1 = Date.now();
      const totalChapters = allChapters.length;
      const chapterNum = chapter.chapter_num;
      AIService.genProgress.set(chapterId, '');
      const jsonStr = story.genre === 'numeric'
      ? await AIService.generateNumericJson(story, chapter.outline_zh, chapter.outline_en, prevChapters, chapterNum, totalChapters, chapterId)
      : await AIService.generateInteractiveJson(story, chapter.outline_zh, chapter.outline_en, prevChapters, chapterNum, totalChapters, chapterId);
      logger.info(`[Generate] AI done in ${((Date.now() - t1) / 1000).toFixed(1)}s, jsonLen=${jsonStr.length}`);

      await StoryModel.updateChapter(chapterId, {
        content_zh: '互动小说已生成',
        content_en: 'Interactive novel generated',
        content_json: jsonStr,
        is_generated: true,
        generating_at: null,
      });
      logger.info(`[Generate] DONE total=${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (err: any) {
      logger.error(`[Generate] FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err.message}`);
      await StoryModel.updateChapter(chapterId, {
        content_zh: '生成失败，请重试。',
        content_en: 'Generation failed, please try again.',
        is_generated: false,
        generating_at: null,
      });
      throw err;
    } finally {
      AIService.genProgress.delete(chapterId);
    }
  }

  /**
   * 提取章节 JSON 中的故事文本，用于前情提要（只取 zh）
   */
  static extractStoryText(contentJson: string): string {
    try {
      const parsed = JSON.parse(contentJson);
      // numeric format: { cards: [...] }
      const nodes: any[] = Array.isArray(parsed) ? parsed : (parsed.cards || []);
      return nodes
        .filter(n => n.type === 'story' || n.type === 'choice')
        .map(n => {
          const text = typeof n.text === 'object' ? n.text.zh : (n.text || '');
          if (n.type === 'choice') {
            // numeric: choices array
            if (Array.isArray(n.choices)) {
              const opts = n.choices.map((c: any, i: number) =>
                `${String.fromCharCode(65 + i)}.${typeof c.label === 'object' ? c.label.zh : c.label}`
              ).join(' ');
              return `[选择] ${text} ${opts}`;
            }
            // mystery: optA/optB
            const a = typeof n.optA === 'object' ? n.optA.zh : n.optA;
            const b = typeof n.optB === 'object' ? n.optB.zh : n.optB;
            return `[选择] ${text} A.${a} B.${b}（正确:${n.correct}）`;
          }
          return text;
        })
        .join(' ');
    } catch {
      return '';
    }
  }

  /**
   * 为新故事生成 N 章大纲（一次 AI 调用，返回 [{zh, en}] 数组）
   */
  static async generateStoryOutlines(story: Story, count: number): Promise<Array<{ zh: string; en: string }>> {
    const isNumeric = story.genre === 'numeric';
    const outlineWordCount = isNumeric ? '约1000字' : '200-300字';
    const outlineWordCountEn = isNumeric ? 'about 1000 words' : '200-300 words';
    const prompt = `你是网文编剧，为以下故事生成${count}个章节大纲。直接输出 JSON 数组，不要任何说明或 markdown。
故事：${story.title_zh}
背景：${story.background_zh || '无'}
类型：${isNumeric ? '数值选择' : '解谜推理'}
要求：
- 大纲文字中不要包含"第X章"等章节序号，只写情节内容
- 第2章起每章必须和前一章高度衔接，情节连贯推进，不得跳跃或重复
- 每章大纲需详尽具体，${outlineWordCount}，把本章的人物行动、关键事件、场景氛围、情节转折、人物心理都交代清楚，让读者清楚知道这章会发生什么
输出格式（共${count}个元素）：[{"zh":"详尽大纲${outlineWordCount}","en":"detailed outline ${outlineWordCountEn}"},...]`;

    const maxTokens = isNumeric ? count * 3000 : 8000;
    const raw = await AIService.callAI(prompt, 'ark', maxTokens, 'deepseek-v3-2-251201');
    let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('AI did not return valid outlines');
    // 去掉 AI 可能残留的章节序号前缀，如"第一章："、"Chapter 1:"
    const strip = (s: string) => s.replace(/^(第[零一二三四五六七八九十百\d]+章[：:：\s]*|Chapter\s*\d+[:\s：]*)/i, '').trim();
    return parsed.slice(0, count).map((o: any) => ({ zh: strip(o.zh || ''), en: strip(o.en || '') }));
  }

  /**
   * 生成数值型互动故事 JSON（GameData 格式，含 statDefs/itemDefs/cards）
   */
  static async generateNumericJson(
    story: Story,
    outlineZh: string,
    outlineEn: string,
    prevChapters: { chapter_num: number; outline_zh: string; content_json: string | null }[] = [],
    chapterNum = 1,
    totalChapters = 1,
    progressKey?: string,
  ): Promise<string> {
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
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，不要有"最终"、"从此"等终结性描述，本章内容只推进情节，为后续章节铺垫。】`;

    const prompt = `你是网文作者，负责生成数值型互动故事 JSON。直接输出 JSON，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
当前章节：${chapterProgress}
本章大纲：${outlineZh}
${endingInstruction}
${prevContext}
内容范围要求（最重要，必须严格遵守）：
- 所有 story 节点和 choice 节点的内容，必须严格局限于【本章大纲】所描述的情节范围之内
- 不得写入大纲未提及的新人物、新地点、新事件
- choice 节点要自然穿插在叙事流程中，出现在情节发展的关键决策点，而非集中堆在末尾
- choice 的选项必须是大纲情节范围内合理存在的决策，不得凭空引入大纲之外的内容

写作风格要求（必须遵守）：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，不用书面语
- 叙事、对话、心理活动交替出现，节奏紧凑
- 文字中绝对禁止使用双引号（"），对话用单引号（'）代替

数值设计要求（非常重要，必须严格遵守）：
- 每个 choice 节点的 effects 中，非零值最多3个（通常2-3个），不要4个全改
- 数值变化必须有增有减（即"数值交换"），例如体力-2同时心情+1，而非全部减少或全部增加
- 8-10个 choice 节点要均匀覆盖4种属性（life/stamina/mood/supplies），不能总是只围绕某几个属性；每种属性至少被2个不同choice节点涉及
- 设计要有挑战性：关键时刻的错误选择应有明显惩罚（生命-3到-4），迫使玩家认真权衡
- effects 字段必须包含所有4个键（不影响的设为0）

输出格式（完整 GameData 对象）：
{
  "title": {"zh":"章节标题","en":"Chapter Title"},
  "description": {"zh":"一句话简介","en":"one-line description"},
  "statDefs": {
    "life":     {"name":{"zh":"生命","en":"Life"},    "icon":"❤️","color":"#ef4444","bg":"#7f1d1d"},
    "stamina":  {"name":{"zh":"体力","en":"Stamina"}, "icon":"⚡","color":"#f59e0b","bg":"#78350f"},
    "mood":     {"name":{"zh":"心情","en":"Mood"},    "icon":"😊","color":"#3b82f6","bg":"#1e3a5f"},
    "supplies": {"name":{"zh":"物资","en":"Supplies"},"icon":"🎒","color":"#22c55e","bg":"#14532d"}
  },
  "itemDefs": {
    "item_key": {"name":{"zh":"物品名","en":"Item Name"},"icon":"🔧","desc":{"zh":"描述","en":"desc"}}
  },
  "cards": [
    {"id":0,"type":"story","act":{"zh":"第X幕 标题","en":"Act X · Title"},"text":{"zh":"...","en":"..."}},
    {"id":1,"type":"story","text":{"zh":"...","en":"..."}},
    {"id":N,"type":"choice","text":{"zh":"面对XX你怎么做？","en":"What do you do?"},"choices":[
      {"label":{"zh":"选项A","en":"Option A"},"text":{"zh":"结果描述（2-3句）","en":"outcome"},"effects":{"life":0,"stamina":-2,"mood":1,"supplies":0},"giveItem":"item_key"},
      {"label":{"zh":"选项B","en":"Option B"},"text":{"zh":"结果描述（2-3句）","en":"outcome"},"effects":{"life":-3,"stamina":0,"mood":0,"supplies":1},"bonusIf":{"item":"item_key","bonus":{"life":2}}}
    ]}
  ],
  "winText": {"zh":"章节通关文本","en":"Chapter clear text"}
}

规则：
- cards 共 60 个节点，其中 8-10 个 choice 节点，story 节点约 49-51 个，最后1个 end 节点
- 每个 choice 必须有 2 个选项（choices 数组长度=2）
- effects 必须包含所有4个数值键（life/stamina/mood/supplies），不影响的设为0；非零值最多3个
- 生命归零=死亡，关键节点可扣3-4点，普通节点扣1-2点
- itemDefs 只定义本章会出现的道具（0-4个）
- statDefs 固定用上述4个数值，不要增删
- giveItem 和 bonusIf 是可选字段，不需要时省略
- 最后一个节点用 type:"end"，text 写通关文本，不需要winText时可省略

输出：`;

    const raw = await AIService.callAI(prompt, 'ark', 16000, 'deepseek-v3-2-251201', progressKey);
    logger.info(`[NumericJson] raw length=${raw.length}, preview="${raw.slice(0, 120).replace(/\n/g, '↵')}"`);
    let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    cleaned = cleaned.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ' ');
    cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")/gs, m =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    );

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      cleaned = fixJson(cleaned);
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2: any) {
        const pos = parseInt(e2.message.match(/position (\d+)/)?.[1] ?? '0');
        logger.error(`[NumericJson] JSON parse failed: ${e2.message} | context: ...${cleaned.slice(Math.max(0, pos - 40), pos + 40)}...`);
        throw e2;
      }
    }
    if (!parsed || !Array.isArray(parsed.cards)) throw new Error('AI did not return valid numeric GameData');
    logger.info(`[NumericJson] parsed cards=${parsed.cards.length}`);

    // 确保最后一个 card 是 end 类型
    const cards = parsed.cards;
    const last = cards[cards.length - 1];
    if (!last || last.type !== 'end') {
      cards.push({
        id: cards.length,
        type: 'end',
        text: { zh: '你完成了这一章的旅程。', en: 'You completed this chapter.' },
      });
    }

    return JSON.stringify(parsed).replace(/[\u0080-\uFFFF]/g, c =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  }

  /**
   * 生成互动小说 JSON（格式与 northern-express.json 相同，所有文本字段为双语 {zh, en}）
   */
  static async generateInteractiveJson(
    story: Story,
    outlineZh: string,
    outlineEn: string,
    prevChapters: { chapter_num: number; outline_zh: string; content_json: string | null }[] = [],
    chapterNum = 1,
    totalChapters = 1,
    progressKey?: string,
  ): Promise<string> {

    // 构建前情上下文
    let prevContext = '';
    if (prevChapters.length > 0) {
      const lines = prevChapters.map(c => {
        const text = c.content_json ? AIService.extractStoryText(c.content_json) : '';
        return `第${c.chapter_num}章（${c.outline_zh}）：${text}`;
      });
      prevContext = `\n前情摘要（请保持故事连贯，人物/设定/情节接续以下内容）：\n${lines.join('\n')}\n`;
    }

    const isLast = chapterNum === totalChapters;
    const chapterProgress = `第${chapterNum}章（共${totalChapters}章）`;
    const endingInstruction = isLast
      ? `【本章是全书最后一章，必须给出完整的故事结局，彻底揭晓谜底并收束所有主线剧情。】`
      : `【本章不是故事结尾（${chapterProgress}），绝对不要结束或终结故事，不要有"最终"、"从此"等终结性描述，本章内容只推进情节，为后续章节铺垫。】`;

    const prompt = `你是网文作者，负责生成互动小说 JSON。直接输出 JSON，不要任何说明。

故事：${story.title_zh}
背景：${story.background_zh}
当前章节：${chapterProgress}
本章大纲：${outlineZh}
${endingInstruction}
${prevContext}
内容范围要求（最重要，必须严格遵守）：
- 所有 story 节点和 choice 节点的内容，必须严格局限于【本章大纲】所描述的情节范围之内
- 不得写入大纲未提及的新人物、新地点、新事件
- choice 节点要自然穿插在叙事流程中，出现在情节发展的关键决策点，而非集中堆在末尾
- choice 的选项必须是大纲情节范围内合理存在的决策，不得凭空引入大纲之外的内容

写作风格要求（必须遵守）：
- 每个 story 节点只写一句话，不超过15字，简洁有力
- 大白话、网文风格，不用书面语
- 叙事、对话、心理活动交替出现，节奏紧凑
- 文字中绝对禁止使用双引号（"），对话用单引号（'）代替

JSON 格式规则：
- type 只能是 "story"、"choice"、"victory"
- story节点：{"id":N,"type":"story","text":{"zh":"一句话","en":"one sentence"}}
- 第一个节点加act：{"id":0,"type":"story","act":{"zh":"第X幕 标题","en":"Act X · Title"},"text":{"zh":"...","en":"..."}}
- choice节点：{"id":N,"type":"choice","text":{"zh":"一句话","en":"..."},"optA":{"zh":"...","en":"..."},"optB":{"zh":"...","en":"..."},"correct":"A或B","penalty":{"zh":"一句话","en":"..."},"hint":{"zh":"...","en":"..."}}
- victory节点（唯一，最后）：{"id":N,"type":"victory","act":{"zh":"尾声","en":"Epilogue"},"text":{"zh":"一句话","en":"..."}}
- 严格控制在 30 个节点以内，其中 3-4 个 choice 节点，超过30个立即停止
- correct 只能是 "A" 或 "B"

输出：`;

    // deepseek-v3 对结构化 JSON 输出更精准
    const raw = await AIService.callAI(prompt, 'ark', 6000, 'deepseek-v3-2-251201', progressKey);
    logger.info(`[InteractiveJson] raw length=${raw.length}, preview="${raw.slice(0, 120).replace(/\n/g, '↵')}"`);

    // 清理 markdown 包裹和控制字符
    let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    cleaned = cleaned.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ' ');
    // 修复字符串内部的裸换行
    cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")/gs, m =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    );

    // 若 JSON 被截断，尝试截取到最后一个完整对象
    if (!cleaned.endsWith(']')) {
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > 0) cleaned = cleaned.substring(0, lastBrace + 1) + ']';
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      cleaned = fixJson(cleaned);
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2: any) {
        const pos = parseInt(e2.message.match(/position (\d+)/)?.[1] ?? '0');
        logger.error(`[InteractiveJson] JSON parse failed: ${e2.message} | context: ...${cleaned.slice(Math.max(0, pos - 40), pos + 40)}...`);
        throw e2;
      }
    }
    if (!Array.isArray(parsed)) throw new Error('AI did not return a JSON array');
    logger.info(`[InteractiveJson] parsed nodes=${parsed.length}`);

    // 确保最后一个节点是 victory（若截断导致缺失则补上）
    const last = parsed[parsed.length - 1];
    if (!last || (last.type !== 'victory' && last.type !== 'verdict')) {
      parsed.push({
        id: parsed.length,
        type: 'victory',
        act: { zh: '尾声', en: 'Epilogue' },
        text: { zh: '故事告一段落。', en: 'The case comes to a close.' },
      });
    }

    // Serialize as ASCII-only JSON (escape all non-ASCII) to avoid encoding issues in DB/API pipeline
    return JSON.stringify(parsed).replace(/[\u0080-\uFFFF]/g, c =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
  }

  static async callAI(prompt: string, provider: 'ark' | 'openrouter' = 'ark', maxTokens = 1000, model?: string, progressKey?: string): Promise<string> {
    if (provider === 'ark') {
      const arkClient = new ArkClient(config.ai.apiKey, config.ai.baseUrl);
      const slog = createStreamLogger(model?.split('-')[0] ?? 'ark');
      slog.info(`model=${model || config.ai.model} maxTokens=${maxTokens}`);
      slog.info(`prompt preview: ${prompt.slice(0, 200).replace(/\n/g, '↵')}`);
      let lastLogAt = 0;
      let content: string;
      try {
        content = await arkClient.chatStream(
          model || config.ai.model,
          [{ role: 'user', content: prompt }],
          {
            maxTokens,
            temperature: 0.8,
            timeoutMs: 180000,
            onChunk: (_delta, total) => {
              if (progressKey) AIService.genProgress.set(progressKey, total);
              if (total.length - lastLogAt >= 200) {
                lastLogAt = total.length;
                slog.info(`received ${total.length} chars so far...`);
              }
            },
          }
        );
      } catch (err: any) {
        slog.error(`stream FAILED: ${err.message}`);
        logger.error(`[AI stream] FAILED model=${model} lastReceived=${lastLogAt} chars: ${err.message}`);
        throw err;
      }
      slog.info(`complete, total=${content.length} chars`);
      slog.info(`response preview: ${content.slice(0, 200).replace(/\n/g, '↵')}`);
      return content;
    }

    const response = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openrouter.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${err}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }
}
