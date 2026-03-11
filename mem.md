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

## platform 架构
- backend: `src/server.ts` → `app.ts`，port 3001
- frontend: Vite，port 5173，`/api` 代理到 3001
- i18n: `translations.ts` 扁平 key（如 `auth_sendCode`）
