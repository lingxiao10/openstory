import mysql from 'mysql2/promise';
import { secret } from './secretConfig';

const DB_HOST = secret.db?.host || 'localhost';
const DB_PORT = secret.db?.port || 3306;
const DB_USER = secret.db?.user || 'root';
const DB_PASSWORD = secret.db?.password || '123456';
const DB_NAME = secret.db?.database || 'storygame';

const migrations: string[] = [
  `ALTER TABLE stories ADD COLUMN player_name VARCHAR(100) NOT NULL DEFAULT ''`,
  `ALTER TABLE stories ADD COLUMN ai_model VARCHAR(100) NOT NULL DEFAULT 'deepseek-v3-2-251201'`,
  `ALTER TABLE chapters ADD COLUMN generating_at DATETIME NULL DEFAULT NULL`,
  `ALTER TABLE chapters ADD COLUMN content_json LONGTEXT NULL`,
  `ALTER TABLE chapters ADD COLUMN outline_en TEXT`,
  `ALTER TABLE chapters ADD COLUMN is_generated BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE chapters ADD COLUMN published BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE chapters ADD COLUMN published_at DATETIME NULL`,
  `ALTER TABLE stories ADD COLUMN background_zh TEXT`,
  `ALTER TABLE stories ADD COLUMN background_en TEXT`,
  `ALTER TABLE stories ADD COLUMN summary_zh VARCHAR(200)`,
  `ALTER TABLE stories ADD COLUMN summary_en VARCHAR(200)`,
  `ALTER TABLE users ADD COLUMN daily_quota INT NULL DEFAULT NULL`,
  `CREATE TABLE IF NOT EXISTS generation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    chapter_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_date (user_id, created_at)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

async function migrate() {
  const connection = await mysql.createConnection({
    host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
  });
  console.log('Connected to MySQL');
  for (const sql of migrations) {
    try {
      await connection.query(sql);
      console.log('OK:', sql.slice(0, 80));
    } catch (err: any) {
      // Ignore "Duplicate column" errors (MySQL < 8 doesn't support IF NOT EXISTS)
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('SKIP (already exists):', sql.slice(0, 80));
      } else {
        console.error('FAIL:', err.message);
      }
    }
  }
  await connection.end();
  console.log('Migration done.');
}

migrate().catch(err => { console.error(err.message); process.exit(1); });
