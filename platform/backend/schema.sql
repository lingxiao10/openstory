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
  generated BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- Migration for existing databases:
-- ALTER TABLE chapters ADD COLUMN outline_en TEXT AFTER outline_zh;
