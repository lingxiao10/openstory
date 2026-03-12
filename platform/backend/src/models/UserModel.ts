import pool from './db';
import { User } from '../types';

export class UserModel {
  static async findByEmail(email: string): Promise<User | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    return rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async create(user: Omit<User, 'created_at'>): Promise<void> {
    await pool.execute(
      'INSERT INTO users (id, username, email, password_hash, lang) VALUES (?, ?, ?, ?, ?)',
      [user.id, user.username, user.email, user.password_hash, user.lang]
    );
  }

  static async search(q: string): Promise<User[]> {
    const like = `%${q}%`;
    const [rows] = await pool.execute<any[]>(
      'SELECT * FROM users WHERE id = ? OR username LIKE ? OR email LIKE ? LIMIT 20',
      [q, like, like]
    );
    return rows;
  }

  static async setDailyQuota(id: string, quota: number | null): Promise<void> {
    await pool.execute('UPDATE users SET daily_quota = ? WHERE id = ?', [quota, id]);
  }
}
