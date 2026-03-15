CREATE DATABASE IF NOT EXISTS storygame CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE storygame;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  lang ENUM('zh','en') DEFAULT 'zh',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title_zh VARCHAR(200) NOT NULL,
  title_en VARCHAR(200) DEFAULT '',
  genre ENUM('mystery','numeric') NOT NULL,
  player_name VARCHAR(100) NOT NULL DEFAULT '',
  status ENUM('draft','generating','published') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR(36) PRIMARY KEY,
  story_id VARCHAR(36) NOT NULL,
  chapter_num INT NOT NULL,
  outline_zh TEXT,
  outline_en TEXT,
  content_zh TEXT,
  content_en TEXT,
  is_generated BOOLEAN DEFAULT FALSE,
  generating_at DATETIME NULL DEFAULT NULL,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- Migration for existing databases (run migrate.ts):
-- ALTER TABLE chapters ADD COLUMN outline_en TEXT AFTER outline_zh;
-- ALTER TABLE chapters ADD COLUMN generating_at DATETIME NULL DEFAULT NULL;
-- ALTER TABLE users ADD COLUMN daily_quota INT NULL DEFAULT NULL;
-- CREATE TABLE generation_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(36), chapter_id VARCHAR(36), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_user_date (user_id, created_at));

CREATE TABLE IF NOT EXISTS chapter_reads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  chapter_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, created_at),
  INDEX idx_chapter_date (chapter_id, created_at)
);

CREATE TABLE IF NOT EXISTS generation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  chapter_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_date (user_id, created_at)
);

