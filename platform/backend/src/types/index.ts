export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  lang: 'zh' | 'en';
  created_at: Date;
}

export interface Story {
  id: string;
  user_id: string;
  title_zh: string;
  title_en: string;
  background_zh: string;
  background_en: string;
  genre: 'mystery' | 'numeric';
  status: 'draft' | 'generating' | 'published';
  created_at: Date;
}

export interface Chapter {
  id: string;
  story_id: string;
  chapter_num: number;
  outline_zh: string;
  outline_en: string;
  content_zh: string;
  content_en: string;
  is_generated: boolean;
  published: boolean;
  published_at: Date | null;
}

export interface GameIndex {
  id: string;
  titleZh: string;
  titleEn: string;
  desc: string;
  type: 'mystery' | 'numeric';
  category: string;
  file: string;
}

export interface AuthPayload {
  userId: string;
  username: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
