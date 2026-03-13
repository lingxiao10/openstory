import { v4 as uuidv4 } from 'uuid';
import { StoryModel } from '../models/StoryModel';
import { Story, Chapter } from '../types';
import { TranslateService } from './TranslateService';
import { AIService } from './AIService';

export class StoryService {
  /**
   * Create a story from user-supplied single-language title/background.
   * TranslateService auto-detects the language and produces the other language.
   */
  static async createStory(userId: string, title: string, genre: 'mystery' | 'numeric', background = '', chapterCount = 0, progressKey?: string, playerName = '', aiModel = 'deepseek-v3-2-251201') {
    const [titleResult, bgResult] = await Promise.all([
      TranslateService.detectAndTranslate(title),
      background ? TranslateService.detectAndTranslate(background) : Promise.resolve({ zh: '', en: '' }),
    ]);

    const id = uuidv4();
    const story: Omit<Story, 'created_at'> = {
      id,
      user_id: userId,
      title_zh: titleResult.zh,
      title_en: titleResult.en,
      background_zh: bgResult.zh,
      background_en: bgResult.en,
      genre,
      status: 'draft',
      player_name: playerName,
      ai_model: aiModel,
    };
    await StoryModel.create(story);

    if (chapterCount > 0) {
      const count = Math.min(Math.max(1, chapterCount), 10);
      const fullStory = { ...story, created_at: new Date() } as Story;
      const outlines = await AIService.generateStoryOutlines(fullStory, count, progressKey);
      for (let i = 0; i < outlines.length; i++) {
        const chapter: Chapter = {
          id: uuidv4(),
          story_id: id,
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
        };
        await StoryModel.createChapter(chapter);
      }
    }

    return id;
  }

  static async getUserStories(userId: string) {
    const stories = await StoryModel.findByUserId(userId);
    const result = [];
    for (const s of stories) {
      const chapters = await StoryModel.getChapters(s.id);
      result.push({ ...s, chapters });
    }
    return result;
  }

  static async getStory(id: string, userId: string) {
    const story = await StoryModel.findById(id);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');
    const chapters = await StoryModel.getChapters(id);
    return { ...story, chapters };
  }

  /**
   * Add a chapter with user-supplied single-language outline.
   * TranslateService produces the other language version.
   */
  static async addChapter(storyId: string, userId: string, outline: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const outlineResult = await TranslateService.detectAndTranslate(outline);

    const chapters = await StoryModel.getChapters(storyId);
    const chapter_num = chapters.length + 1;
    const id = uuidv4();
    const chapter: Chapter = {
      id,
      story_id: storyId,
      chapter_num,
      outline_zh: outlineResult.zh,
      outline_en: outlineResult.en,
      content_zh: '',
      content_en: '',
      content_json: null,
      is_generated: false,
      generating_at: null,
      published: false,
      published_at: null,
    };
    await StoryModel.createChapter(chapter);
    return id;
  }

  static async updateChapterOutline(storyId: string, chapterId: string, userId: string, outline: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.published) throw new Error('Cannot edit a published chapter');

    const result = await TranslateService.detectAndTranslate(outline);
    await StoryModel.updateChapterOutline(chapterId, result.zh, result.en);
  }

  static async deleteChapter(storyId: string, chapterId: string, userId: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (chapter.published) throw new Error('Cannot delete a published chapter');

    await StoryModel.deleteChapter(chapterId);
    await StoryModel.renumberChapters(storyId);
  }

  static async publishChapter(storyId: string, chapterId: string, userId: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (!chapter.is_generated) throw new Error('Chapter must be generated before publishing');
    if (chapter.published) throw new Error('Chapter already published');

    // Enforce sequential publishing
    const chapters = await StoryModel.getChapters(storyId);
    if (chapter.chapter_num > 1) {
      const prev = chapters.find(c => c.chapter_num === chapter.chapter_num - 1);
      if (!prev || !prev.published) throw new Error('Previous chapter must be published first');
    }

    await StoryModel.updateChapter(chapterId, { published: true, published_at: new Date() });
    await StoryModel.updateStatus(storyId, 'published');
  }

  static async unpublishChapter(storyId: string, chapterId: string, userId: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const chapter = await StoryModel.findChapterById(chapterId);
    if (!chapter) throw new Error('Chapter not found');
    if (!chapter.published) throw new Error('Chapter is not published');

    // Only the last published chapter can be unpublished
    const chapters = await StoryModel.getChapters(storyId);
    const publishedChapters = chapters.filter(c => c.published);
    const lastPublished = publishedChapters.reduce((max, c) => c.chapter_num > max.chapter_num ? c : max, publishedChapters[0]);
    if (lastPublished.id !== chapterId) throw new Error('只能取消发布最后一章 / Only the last published chapter can be unpublished');

    await StoryModel.updateChapter(chapterId, { published: false, published_at: null });

    // If no more published chapters, revert story status to draft
    if (publishedChapters.length === 1) {
      await StoryModel.updateStatus(storyId, 'draft');
    }
  }

  static async deleteStory(storyId: string, userId: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    if (story.user_id !== userId) throw new Error('Forbidden');

    const chapters = await StoryModel.getChapters(storyId);
    const publishedCount = chapters.filter(c => c.published).length;

    // Unpublish all chapters, then delete
    if (publishedCount > 0) {
      await StoryModel.unpublishAllChapters(storyId);
    }
    await StoryModel.deleteAllChapters(storyId);
    await StoryModel.deleteStory(storyId);

    return { publishedCount };
  }

  static async getPublicStories() {
    return StoryModel.getPublicStories();
  }

  static async getPublicStory(storyId: string) {
    const story = await StoryModel.findById(storyId);
    if (!story) throw new Error('Story not found');
    const chapters = await StoryModel.getPublishedChapters(storyId);
    return { ...story, chapters };
  }
}
