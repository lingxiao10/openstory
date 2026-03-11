import { config } from '../config';
import { StoryModel } from '../models/StoryModel';

export class AIService {
  /** Check sequential constraint (throws if violated). Called before responding to client. */
  static async validateSequential(storyId: string, chapterId: string): Promise<void> {
    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.published) throw new Error('Cannot regenerate a published chapter');
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
    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.published) throw new Error('Cannot regenerate a published chapter');

    const promptZh = `你是一名专业故事作者。请根据以下大纲，写一段300-500字的故事内容（中文）：\n\n大纲：${chapter.outline_zh}\n\n请直接输出故事正文，不要输出标题或其他说明。`;
    const promptEn = `You are a professional story writer. Based on the following outline, write a 200-400 word story passage in English:\n\nOutline: ${chapter.outline_en || chapter.outline_zh}\n\nOutput only the story text, no title or explanations.`;

    await StoryModel.updateChapter(chapterId, { content_zh: '生成中...', content_en: 'Generating...', is_generated: false });

    try {
      const [zhContent, enContent] = await Promise.all([
        AIService.callAI(promptZh),
        AIService.callAI(promptEn),
      ]);
      await StoryModel.updateChapter(chapterId, {
        content_zh: zhContent,
        content_en: enContent,
        is_generated: true,
      });
    } catch (err) {
      await StoryModel.updateChapter(chapterId, {
        content_zh: '生成失败，请重试。',
        content_en: 'Generation failed, please try again.',
        is_generated: false,
      });
      throw err;
    }
  }

  static async callAI(prompt: string): Promise<string> {
    const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
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
