import { BilingualText } from '../i18n/translations';

export interface GameIndex {
  id: string;
  title: BilingualText;
  desc: BilingualText;
  type: 'mystery' | 'numeric';
  category: string;
}

export interface GameDetail extends GameIndex {
  data: any;
}

// Public story card (from /api/stories/public)
export interface PublicStory {
  id: string;
  title_zh: string;
  title_en: string;
  background_zh: string;
  background_en: string;
  genre: 'mystery' | 'numeric';
  published_count: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  lang: 'zh' | 'en';
}
