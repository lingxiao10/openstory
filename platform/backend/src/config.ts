import { secret } from './secretConfig';

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  jwtSecret: process.env.JWT_SECRET || 'storygame-secret-key-change-in-production',
  jwtExpiresIn: '7d',
  db: {
    host: process.env.DB_HOST || secret.db?.host || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (secret.db?.port ?? 3306),
    user: process.env.DB_USER || secret.db?.user || 'root',
    password: process.env.DB_PASSWORD || secret.db?.password || '123456',
    database: process.env.DB_NAME || secret.db?.database || 'storygame',
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY || secret.openrouter_api_key || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
  },
  translate: {
    baseUrl: process.env.TRANSLATE_BASE_URL || process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: process.env.TRANSLATE_API_KEY || process.env.AI_API_KEY || secret.openrouter_api_key || '',
    model: 'x-ai/grok-code-fast-1',
  },
  storiesDir: process.env.STORIES_DIR || '../stories',
  resend: {
    apiKey: secret.resend_api_key || '',
    from: secret.resend_from || '',
  },
  needCheckEmail: secret.need_check_email ?? false,
};
