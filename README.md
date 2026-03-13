# OpenStory

**[English](#english) | [中文](#chinese)**

---

## 🌐 Live Demo

> **[https://openstory.xfeixie.com/](https://openstory.xfeixie.com/)**
> <ins>Try the live platform powered by this open-source project</ins>

---

<a name="english"></a>
## English

### What is OpenStory?

OpenStory is an open-source interactive story game platform. Players can explore mystery card games and numeric choice adventures, and creators can build and share their own story games.

> **Live platform:** <ins>[https://openstory.xfeixie.com/](https://openstory.xfeixie.com/)</ins>

### Features

- Mystery card game engine (clues, choices, suspects, verdict)
- Numeric adventure engine (stats, items, branching choices)
- User authentication with optional email verification
- AI-assisted story generation
- Multilingual UI (Chinese / English)
- Full-stack: React + TypeScript frontend, Node.js + Express backend, MySQL database

### Project Structure

```
storygame/
├── story/           # Standalone mystery card game (CDN React)
├── storychoose/     # Standalone numeric choice game (CDN React)
└── platform/        # Full-stack platform
    ├── frontend/    # React + TypeScript + Vite (port 5173)
    └── backend/     # Node.js + TypeScript + Express + MySQL (port 3001)
```

### Quick Start

**Prerequisites:** Node.js 18+, MySQL 8+

**1. Configure secrets**

Copy `secret_json_default.json` to `secret_json.json` and fill in your values:

```json
{
  "db": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "your_password",
    "database": "storygame"
  },
  "jwt_secret": "your_jwt_secret",
  "ai_api_key": "your_ai_api_key",
  "ai_base_url": "https://api.openai.com/v1",
  "need_check_email": false
}
```

**2. Initialize database**

```bash
init-db.bat
# or manually:
cd platform/backend && npx ts-node src/initDb.ts
```

**3. Start backend**

```bash
cd platform/backend
npm install
npm run dev
```

**4. Start frontend**

```bash
cd platform/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Backend | Node.js, TypeScript, Express, ts-node-dev |
| Database | MySQL 8, mysql2 |
| Auth | JWT, optional email verification (Resend) |
| AI | OpenAI-compatible API |

### License

Licensed under the [Apache License 2.0](LICENSE).

---

<a name="chinese"></a>
## 中文

### 什么是 OpenStory？

OpenStory 是一个开源互动故事游戏平台。玩家可以体验推理卡牌游戏和数值选择冒险，创作者可以构建并分享自己的故事游戏。

> **在线体验：** <ins>[https://openstory.xfeixie.com/](https://openstory.xfeixie.com/)</ins>

### 功能特性

- 推理卡牌游戏引擎（线索、选择、嫌疑人、裁决）
- 数值冒险游戏引擎（属性、物品、分支选择）
- 用户认证，支持可选的邮箱验证
- AI 辅助故事生成
- 多语言界面（中文 / 英文）
- 全栈架构：React + TypeScript 前端，Node.js + Express 后端，MySQL 数据库

### 项目结构

```
storygame/
├── story/           # 独立推理卡牌游戏（CDN React）
├── storychoose/     # 独立数值选择游戏（CDN React）
└── platform/        # 全栈平台
    ├── frontend/    # React + TypeScript + Vite（端口 5173）
    └── backend/     # Node.js + TypeScript + Express + MySQL（端口 3001）
```

### 快速开始

**前置要求：** Node.js 18+，MySQL 8+

**1. 配置密钥**

将 `secret_json_default.json` 复制为 `secret_json.json`，填入你的配置：

```json
{
  "db": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "你的密码",
    "database": "storygame"
  },
  "jwt_secret": "你的JWT密钥",
  "ai_api_key": "你的AI接口密钥",
  "ai_base_url": "https://api.openai.com/v1",
  "need_check_email": false
}
```

**2. 初始化数据库**

```bash
init-db.bat
# 或手动执行：
cd platform/backend && npx ts-node src/initDb.ts
```

**3. 启动后端**

```bash
cd platform/backend
npm install
npm run dev
```

**4. 启动前端**

```bash
cd platform/frontend
npm install
npm run dev
```

在浏览器中打开 [http://localhost:5173](http://localhost:5173)。

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18、TypeScript、Vite、React Router v6 |
| 后端 | Node.js、TypeScript、Express、ts-node-dev |
| 数据库 | MySQL 8、mysql2 |
| 认证 | JWT，可选邮箱验证（Resend） |
| AI | 兼容 OpenAI 的 API 接口 |

### 开源协议

本项目使用 [Apache License 2.0](LICENSE) 开源协议。
