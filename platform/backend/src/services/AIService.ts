import { config } from '../config';
import { Story } from '../types';
import { ArkClient } from '../libs/ark/ArkClient';
import { logger, createStreamLogger } from '../logger';

function getProvider(model: string): 'ark' | 'openrouter' {
  return model.startsWith('google/') ? 'openrouter' : 'ark';
}

export class AIService {
  /** 当前正在生成的进度文本，key=progressKey */
  static readonly genProgress = new Map<string, string>();

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
  static async generateStoryOutlines(story: Story, count: number, progressKey?: string): Promise<Array<{ zh: string; en: string }>> {
    const isNumeric = story.genre === 'numeric';
    const playerName = story.player_name?.trim() || '';
    const playerPrompt = playerName
      ? `\n玩家控制的角色是：${playerName}，以第三人称（${playerName}）的视角来生成互动小说，注意，所有的选择决定都以玩家角色视角来面对和决定的。`
      : '';
    const prompt = `你是网文编剧，为以下故事生成${count}个章节大纲。直接输出 JSON 数组，不要任何说明或 markdown。
故事：${story.title_zh}
背景：${story.background_zh || '无'}${playerPrompt}
要求：
- 大纲文字中不要包含"第X章"等章节序号，只写情节内容
- 第2章起每章必须和前一章高度衔接，情节连贯推进，不得跳跃或重复
- 每章大纲需详尽具体，约500字，把本章的人物行动、关键事件、场景氛围、情节转折、人物心理都交代清楚，让读者清楚知道这章会发生什么
输出格式（共${count}个元素）：[{"zh":"详尽大纲约500字","en":"detailed outline about 500 words"},...]`;

    const aiModel = story.ai_model || 'deepseek-v3-2-251201';
    const provider = getProvider(aiModel);
    const maxTokens = count * 1200;
    if (progressKey) AIService.genProgress.set(progressKey, '');
    let raw: string;
    try {
      raw = await AIService.callAI(prompt, provider, maxTokens, aiModel, progressKey);
    } finally {
      AIService.genProgress.delete(progressKey ?? '');
    }
    let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('AI did not return valid outlines');
    // 去掉 AI 可能残留的章节序号前缀，如"第一章："、"Chapter 1:"
    const strip = (s: string) => s.replace(/^(第[零一二三四五六七八九十百\d]+章[：:：\s]*|Chapter\s*\d+[:\s：]*)/i, '').trim();
    return parsed.slice(0, count).map((o: any) => ({ zh: strip(o.zh || ''), en: strip(o.en || '') }));
  }

  static async callAI(prompt: string, provider: 'ark' | 'openrouter' = 'ark', maxTokens = 1000, model?: string, progressKey?: string, onChunk?: (delta: string) => void): Promise<string> {
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
            timeoutMs: 600000,
            onChunk: (delta, total) => {
              if (progressKey) AIService.genProgress.set(progressKey, total);
              if (onChunk && delta) onChunk(delta);
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

    const orModel = model || config.ai.model;
    const slog = createStreamLogger(orModel.split('/').pop()?.split('-')[0] ?? 'or');
    slog.info(`openrouter model=${orModel} maxTokens=${maxTokens}`);
    slog.info(`prompt preview: ${prompt.slice(0, 200).replace(/\n/g, '↵')}`);

    const response = await fetch(`${config.openrouter.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openrouter.apiKey}`,
      },
      body: JSON.stringify({
        model: orModel,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      slog.error(`request failed: ${err.slice(0, 200)}`);
      throw new Error(`OpenRouter API error: ${err}`);
    }

    if (!response.body) throw new Error('OpenRouter returned no response body');

    let content = '';
    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastLogAt = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            content += delta;
            if (progressKey) AIService.genProgress.set(progressKey, content);
            if (onChunk) onChunk(delta);
            if (content.length - lastLogAt >= 200) {
              lastLogAt = content.length;
              slog.info(`received ${content.length} chars so far...`);
            }
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    slog.info(`complete, total=${content.length} chars`);
    slog.info(`response preview: ${content.slice(0, 200).replace(/\n/g, '↵')}`);
    return content;
  }
}
