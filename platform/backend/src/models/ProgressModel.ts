import pool from './db';

export class ProgressModel {
  static async complete(userId: string, chapterId: string): Promise<void> {
    await pool.execute(
      'INSERT IGNORE INTO user_progress (user_id, chapter_id) VALUES (?, ?)',
      [userId, chapterId]
    );
  }

  static async getCompletedChapterIds(userId: string): Promise<string[]> {
    const [rows] = await pool.execute<any[]>(
      'SELECT chapter_id FROM user_progress WHERE user_id = ?',
      [userId]
    );
    return rows.map(r => r.chapter_id);
  }

  static async isCompleted(userId: string, chapterId: string): Promise<boolean> {
    const [rows] = await pool.execute<any[]>(
      'SELECT 1 FROM user_progress WHERE user_id = ? AND chapter_id = ?',
      [userId, chapterId]
    );
    return rows.length > 0;
  }
}
