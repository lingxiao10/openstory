# storygame mem

## secret_json 配置加载（2026-03-12）
- `secret_json.json`（git忽略）> 回落 `secret_json_default.json`
- 加载器：`platform/backend/src/secretConfig.ts`（__dirname 相对路径 `../../../`）
- `config.ts` 统一导出 `config.needCheckEmail` / `config.resend`

## need_check_email 邮箱验证
- `need_check_email: true` → 注册需发送验证码（6位，5分钟有效，内存 Map 存储）
- `need_check_email: false` → 直接注册，仅验证邮箱唯一性
- 后端新接口：`GET /api/auth/config`、`POST /api/auth/send-code`
- 邮件：Resend API（`EmailService.ts`，直接 fetch）
- 前端：Register.tsx 首次加载获取 config，条件显示验证码输入行

## 数据库初始化工具
- `init-db.bat`（根目录）→ 执行 `platform/backend/src/initDb.ts`
- `initDb.ts` 读取 `schema.sql`，用 mysql2 multipleStatements 执行
- 环境变量：DB_HOST/DB_PORT/DB_USER/DB_PASSWORD（默认 localhost/3306/root/123456）

## 新建故事自动生成章节
- 创建故事时传 `chapterCount`（1-10），后端一次 AI 调用生成所有章节大纲
- `StoryService.createStory(..., chapterCount, progressKey, playerName, aiModel)` 服务端上限 clamp 到 10
- 故事表新增字段：`player_name`（玩家角色名）、`ai_model`（选用模型）

## 玩家角色名 & 模型选择（2026-03-13）
- `stories.player_name`：创建时填写，生成大纲/章节 JSON 时注入提示词："玩家控制的角色是：{name}，以第三人称视角..."
- `stories.ai_model`：创建时选择，后续所有 AI 调用均使用此模型
- 可选模型：deepseek-v3-2-251201(ark)、doubao-seed-1-8-251228(ark)、google/gemini-2.5-pro(openrouter)、google/gemini-2.5-flash(openrouter)
- provider 由 `getProvider(model)` 自动判断：`model.startsWith('google/')` → openrouter，其余 → ark
- openrouter 调用已升级为 SSE 流式（与 ark 一样支持 genProgress 实时进度）
- 防重复大纲生成：前端 `creatingRef`（ref 级别 guard）+ 后端 `creatingSet`（per-user 锁）

## 生成防重复提交保护 & 状态持久化
- `chapters.generating_at DATETIME NULL`：生成开始时写入，完成/失败时清空（NULL）
- 超时5分钟（`GENERATE_TIMEOUT_MS = 5*60*1000`，前后端共用）
- `validateSequential` 检查 DB generating_at，超时则清空允许重试
- `GenerateController` 内存 Set 作进程内快速拦截
- 前端：`isChapterGenerating(ch)` 读 DB 状态；`useEffect` 在刷新后自动恢复轮询
- `pollUntilDone` 以 `!ch.generating_at` 为完成信号（成功/失败统一）
- 迁移 SQL：`ALTER TABLE chapters ADD COLUMN generating_at DATETIME NULL DEFAULT NULL;`

## AI 生成章节（互动小说 JSON）
- `generateChapter` 向子函数传 `chapterNum` 和 `totalChapters`
- prompt 含 `第N章（共M章）`；非末章注入"绝对不要结束故事"指令；末章注入"必须给出完整结局"指令
- `AIService.generateChapter` 按 story.genre 分支调用：
  - mystery → `generateInteractiveJson`：生成数组 `[{id,type,text,...}]`，节点类型 story/choice/victory，choice 含 optA/optB/correct/penalty/hint
  - numeric → `generateNumericJson`：生成 GameData 对象 `{title,description,statDefs,itemDefs,cards,winText}`，cards 中 choice 节点含 choices 数组（effects/giveItem/bonusIf）
- statDefs 4个属性由 AI 根据故事主题自由设计（键名英文小写），推荐参考：物资版 life/stamina/mood/supplies、金币版 life/stamina/mood/gold，也可完全自定义（武侠内力/声望、太空氧气/电力等）；itemDefs 按章节内容动态定义（0-4个）；前端 NumericEngine 动态读取键名，天然支持
- 互动JSON生成专用模型：`deepseek-v3-2-251201`
- mystery: maxTokens=6000，节点 30 个内，3-4个choice，story节点一句话≤15字
- numeric: maxTokens=16000，节点 60 个，8-10个choice，story节点一句话≤15字
- numeric choice effects：非零值最多3个（通常2-3个）、必须有增有减（数值交换）、8-10个choice均匀覆盖4种属性、关键节点惩罚-3到-4
- numeric 章节大纲：约1000字（mystery为200-300字）；大纲 maxTokens = count×3000
- `extractStoryText` 同时支持两种格式（数组 / {cards:[...]}）
- 前端 `StoryReader.tsx`：mystery 传 `{cards:parsed}`，numeric 直接传解析后 GameData 对象

## 每日生成限额 & 管理后台
- `secret_json.json`: `daily_gen_limit_enabled`(开关), `daily_gen_limit`(默认10), `admin_email`
- `generation_logs` 表记录成功生成；`users.daily_quota` 存个人覆盖值（NULL=用系统默认）
- `QuotaService.check(userId)` 超额抛 `{code:'QUOTA_EXCEEDED'}`，GenerateController 返回 429
- 前端捕获 429/QUOTA_EXCEEDED → 弹窗显示微信号 linginlove
- 管理后台: `/admin` 路由，需 `user.isAdmin=true`（登录时后端按 admin_email 判断）
- 管理后台功能：搜索用户（ID/用户名/邮箱）、查看今日用量、设置个人额度
- `requireAdmin` 中间件：查 DB 验证邮箱 === config.adminEmail

## 后端错误国际化规范
- 后端 throw Error 同时在 controller 层附 `code` 字段返回：`res.json({ error: msg, code })`
- 前端 `queryWork.ts` 已读取 `err.code`；catch 时用 `err_${code}` 查 translations，找不到则回退 `e.message`
- 已有 code：`QUOTA_EXCEEDED`（429）、`PREV_CHAPTER_NOT_PUBLISHED`（400，发布章节顺序校验）
- translations key 命名：`err_CODE_NAME`

## platform 架构
- backend: `src/server.ts` → `app.ts`，port 3001
- frontend: Vite，port 5173（被占时自动 5174），`/api` 代理到 3001
- i18n: `translations.ts` 扁平 key（如 `auth_sendCode`）；所有引擎文字必须用 `t()`，禁用 `lang === 'en' ? ... : ...`

## 游戏引擎 i18n 规范
- 所有引擎文字通过 `t(key)` 国际化，键前缀 `game_`
- 章节结束胜利文字：优先读 `gameData.winText`（BilingualText），无则 fallback `t('game_win')` = "你顺利完成了本章。"
- `winText` 字段在每章节 JSON 中单独配置（numeric engine）

## 生成进度实时显示
- `AIService.genProgress`: `Map<chapterId, string>`，AI流式生成时实时写入当前累计文本
- `callAI` 支持 `progressKey?: string` 参数，`onChunk` 时更新 Map
- `generateChapter` 在 finally 块中清除 Map 条目
- 新路由: `GET /api/generate/:storyId/:chapterId/progress` → `{ text, chars }`
- 前端 `StoryCard` 轮询（800ms），生成结束后延迟1秒关闭右下角消息框
- 消息框：fixed 右下角，280px宽，最高180px，显示最新300字 + 字数

## 故事删除
- `DELETE /api/stories/:id`：删除故事及全部章节；若有已发布章节，先 unpublish 再删
- 前端 StoryCard：右上角红色"删除"按钮（e.stopPropagation 防止折叠触发）
- 确认弹窗：若有已发布章节显示黄色警告提示（几章将下架），确认后执行删除
- StoryModel 新增 `unpublishAllChapters` / `deleteAllChapters` / `deleteStory`
- StoryService.deleteStory 返回 `{ publishedCount }`，Controller 透传给前端

## 边看边生成（stream-game，2026-03-15）
- 入口：首页"⚡边玩边生成"绿色光泽按钮 → QuickCreateModal → `/stream-game/:storyId`
- 后端路由 `/api/stream-game/`: `POST /start`（创建故事+生成outlines）, `GET /:id/events`（SSE流）, `POST /:id/retry/:chap`（重试）
- SSE 认证：EventSource 不支持 header，通过 `?token=` query param（`requireAuthOrQuery` 中间件）
- 解析格式：`<node>{JSON}</node>` XML包裹 JSON，`<meta>{JSON}</meta>` 用于 numeric 元数据
- `XmlStreamParser.ts`: buffer+边界检测，parseJson含fixJson回退，retry逻辑处理假边界
- `StreamGameService.ts`: sessions Map，25秒heartbeat，eventLog replay断线重连，2小时TTL
- 流式引擎: `StreamMysteryEngine.tsx`（isWaiting → tapHint变脉冲"正在生成下一幕"），`StreamNumericEngine.tsx`（isWaiting+waiting state，useEffect监听data.length自动resume）
- AIService.callAI 新增可选第6个参数 `onChunk?: (delta: string) => void`（向后兼容）
- 生成流程：先同步生成outlines → 顺序生成各章 XML → 每个</node>到来即广播SSE node事件 → 章节完成存DB(转JSON)
- 章节失败：broadcast chapter_error，前端显示重试按钮（不影响其他章节）
- 弹窗交互：所有 Modal 禁用点击背景关闭，必须点 × 按钮（避免误操作）

## 批量生成故事（纯前端）
- 标题栏"批量生成"按钮 → 打开 `BatchCreateModal`（独立于现有创建逻辑）
- 最多 5 个故事 slot，每个填：标题/背景/玩家名/类型/AI模型/章节数
- 点"并发生成 N 个故事" → `Promise.allSettled` 并发调用 `/api/stories` POST
- 每个 slot 独立显示状态（idle/creating/done/error）
- 全部完成后调 `load()` 刷新列表，点"完成关闭"关弹窗

## 卡片模式（唯一展示风格）
- 卡片风格：`MysteryCardEngine.tsx`（`games/mystery/`），随机旋转 + 3条命，自带返回/胜利界面
- `MysteryCardEngine` 内置色调切换：localStorage key `card_tone`（`dark` | `light`），**默认 `dark`**
  - 暗色调（dark）：深棕黑底 `#1C1510`，暖金字 `#C9A84C`，暗色背景
  - 白色调（light）：羊皮纸底 `#F4EAD5`，深棕字 `#2C1810`，米白背景
  - 切换按钮位于右上角，lives 位于右下角：`☀ 白色调` / `☾ 暗色调`
- 接口：`{ gameData, onVictory?, onBack? }`
- numeric 类型卡片风格：视觉完全照搬 MysteryCardEngine（暗色/白色调切换、纸质卡片、角装饰、渐晕背景）
  - stats 4项固定页面底部，竖向进度条（52×70px，颜色高度代表数值百分比）；items 显示在 stats 上方
  - 选择后显示 narrative 卡片（含属性变化徽章+获得物品），轻触继续
  - 移动端微旋转（max ±0.8°），PC/Mac（UA检测 `navigator.userAgent`）不旋转
  - 卡片切换动画：`cardIn .3s ease`（透明度渐变）
  - `NumericEngine.tsx` 和 `StreamNumericEngine.tsx` 均已实现
- **无进度条**：底部进度条已移除，不再显示章节进度

## PM2 服务管理
- 配置文件：根目录 `ecosystem.config.js`
- Windows 需用 `script: 'C:\\Windows\\System32\\cmd.exe', args: '/c npm run dev', interpreter: 'none'`
- 常用命令：
  - 后端改用编译产物：`script: 'node', args: 'dist/server.js'`（ts-node-dev bash脚本在Windows会崩溃）
- 每次改后端代码后需先 `npm run build`，再 `pm2 restart storygame-backend`
- `pm2 start ecosystem.config.js` 启动
  - `pm2 restart all` / `pm2 restart storygame-backend` 重启
  - `pm2 stop all` 停止
  - `pm2 list` 查状态，`pm2 logs` 看日志
