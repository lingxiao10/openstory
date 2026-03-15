## 语言原则
- **必须全程用中文回复**，不得使用韩文或其他语言

## 前端国际化规范（强制）
- **所有用户可见的文字字符串，必须通过 `t()` 翻译函数处理**，不允许在 JSX 中硬编码中文或英文
- 新增文案时，先在 `platform/frontend/src/i18n/translations.ts` 添加双语 key，再用 `t('key')` 引用
- 英文模式下，不允许出现任何中文字符（fallback 逻辑：英文内容 → 中文内容，仅限内容字段如故事摘要，UI 字符串必须有英文 key）
- 例外：`LanguageSwitcher` 中的"中文"按钮标签是正确的，不需要改

mem.md是我们项目记忆文件，每次更新之后，都必须要更新mem.md，必须要非常精简
## Linux 文件权限避坑

- 当前用户是 `claudeuser`，项目文件所有者混合了 `root` 和 `devuser`
- 使用 Edit/Write 工具写文件前，先用 `ls -la` 确认文件所有者和权限
- 若文件属于 `root`（`-rw-r--r-- 1 root root`），Edit/Write 工具会报 `EACCES: permission denied`
- 遇到 root 拥有的文件，改用 `sudo` + Bash 命令操作，例如：`sudo sed -i ...` 或 `sudo tee`
- 属于 `devuser` 的文件（如 src/ 下的 .ts 文件）可直接用 Edit/Write 工具，无需 sudo
