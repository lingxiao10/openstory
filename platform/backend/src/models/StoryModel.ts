import pool from './db';
import { Story, Chapter } from '../types';

export class StoryModel {
  static async findByUserId(userId: string): Promise<Story[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM stories WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  static async findById(id: string): Promise<Story | null> {
    const [rows] = await pool.execute<any[]>('SELECT * FROM stories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(story: Omit<Story, 'created_at'>): Promise<void> {
    await pool.execute(
      'INSERT INTO stories (id, user_id, title_zh, title_en, background_zh, background_en, genre, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [story.id, story.user_id, story.title_zh, story.title_en, story.background_zh || '', story.background_en || '', story.genre, story.status]
    );
  }

  static async updateStatus(id: string, status: Story['status']): Promise<void> {
    await pool.execute('UPDATE stories SET status = ? WHERE id = ?', [status, id]);
  }

  // Get all stories that have at least 1 published chapter (for public listing)
  static async getPublicStories(): Promise<any[]> {
    const [rows] = await pool.execute<any[]>(`
      SELECT s.*, COUNT(c.id) as published_count
      FROM stories s
      JOIN chapters c ON c.story_id = s.id AND c.published = 1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);
    return rows;
  }

  static async getChapters(storyId: string): Promise<Chapter[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM chapters WHERE story_id = ? ORDER BY chapter_num',
      [storyId]
    );
    return rows;
  }

  static async getPublishedChapters(storyId: string): Promise<Chapter[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM chapters WHERE story_id = ? AND published = 1 ORDER BY chapter_num',
      [storyId]
    );
    return rows;
  }

  static async findChapterById(id: string): Promise<Chapter | null> {
    const [rows] = await pool.execute<any[]>('SELECT * FROM chapters WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async createChapter(chapter: Chapter): Promise<void> {
    await pool.execute(
      'INSERT INTO chapters (id, story_id, chapter_num, outline_zh, outline_en, content_zh, content_en, content_json, is_generated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [chapter.id, chapter.story_id, chapter.chapter_num, chapter.outline_zh, chapter.outline_en || '', chapter.content_zh, chapter.content_en, chapter.content_json ?? null, chapter.is_generated ? 1 : 0]
    );
  }

  static async updateChapter(id: string, fields: Partial<Chapter>): Promise<void> {
    const sets: string[] = [];
    const vals: any[] = [];
    if (fields.content_zh !== undefined) { sets.push('content_zh = ?'); vals.push(fields.content_zh); }
    if (fields.content_en !== undefined) { sets.push('content_en = ?'); vals.push(fields.content_en); }
    if (fields.content_json !== undefined) { sets.push('content_json = ?'); vals.push(fields.content_json); }
    if (fields.is_generated !== undefined) { sets.push('is_generated = ?'); vals.push(fields.is_generated ? 1 : 0); }
    if (fields.generating_at !== undefined) { sets.push('generating_at = ?'); vals.push(fields.generating_at); }
    if (fields.published !== undefined) { sets.push('published = ?'); vals.push(fields.published ? 1 : 0); }
    if (fields.published_at !== undefined) { sets.push('published_at = ?'); vals.push(fields.published_at); }
    if (sets.length === 0) return;
    vals.push(id);
    await pool.execute(`UPDATE chapters SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  static async updateChapterOutline(id: string, outlineZh: string, outlineEn: string): Promise<void> {
    await pool.execute(
      'UPDATE chapters SET outline_zh = ?, outline_en = ? WHERE id = ?',
      [outlineZh, outlineEn, id]
    );
  }

  static async deleteChapter(id: string): Promise<void> {
    await pool.execute('DELETE FROM chapters WHERE id = ?', [id]);
    // Re-number remaining chapters
  }

  static async unpublishAllChapters(storyId: string): Promise<void> {
    await pool.execute('UPDATE chapters SET published = 0, published_at = NULL WHERE story_id = ?', [storyId]);
  }

  static async deleteAllChapters(storyId: string): Promise<void> {
    await pool.execute('DELETE FROM chapters WHERE story_id = ?', [storyId]);
  }

  static async deleteStory(id: string): Promise<void> {
    await pool.execute('DELETE FROM stories WHERE id = ?', [id]);
  }

  static async renumberChapters(storyId: string): Promise<void> {
    const [rows] = await pool.execute<any[]>(
      'SELECT id FROM chapters WHERE story_id = ? ORDER BY chapter_num',
      [storyId]
    );
    for (let i = 0; i < rows.length; i++) {
      await pool.execute('UPDATE chapters SET chapter_num = ? WHERE id = ?', [i + 1, rows[i].id]);
    }
  }
}
