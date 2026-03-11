export const translations = {
  // nav
  nav_home:     { zh: '游戏库',     en: 'Library' },
  nav_create:   { zh: 'AI生成故事', en: 'AI Story' },
  nav_login:    { zh: '登录',       en: 'Login' },
  nav_register: { zh: '注册',       en: 'Register' },
  nav_logout:   { zh: '退出',       en: 'Logout' },

  // home
  home_title:    { zh: '轻几互动小说', en: 'OpenStory' },
  home_subtitle: { zh: 'OpenStory · 在故事里，每一步都是你的选择', en: 'Every choice writes the story.' },
  home_mystery:  { zh: '解谜推理', en: 'Mystery' },
  home_numeric:  { zh: '数值选择', en: 'Numeric Choice' },
  home_play:     { zh: '开始游戏', en: 'Play' },
  home_all:      { zh: '全部',     en: 'All' },

  // game
  game_loading: { zh: '加载中...', en: 'Loading...' },
  game_error:   { zh: '加载失败',  en: 'Failed to load' },
  game_back:    { zh: '返回',      en: 'Back' },

  // auth
  auth_username:      { zh: '用户名',       en: 'Username' },
  auth_email:         { zh: '邮箱',         en: 'Email' },
  auth_password:      { zh: '密码',         en: 'Password' },
  auth_login:         { zh: '登录',         en: 'Login' },
  auth_register:      { zh: '注册',         en: 'Register' },
  auth_loginTitle:    { zh: '登录账号',     en: 'Sign In' },
  auth_registerTitle: { zh: '创建账号',     en: 'Create Account' },
  auth_noAccount:     { zh: '没有账号？',   en: "Don't have an account?" },
  auth_hasAccount:    { zh: '已有账号？',   en: 'Already have an account?' },
  auth_registerLink:  { zh: '立即注册',     en: 'Sign up' },
  auth_loginLink:     { zh: '去登录',       en: 'Sign in' },
  auth_error:         { zh: '操作失败，请重试', en: 'Operation failed, please try again' },
  auth_verifyCode:    { zh: '验证码',           en: 'Verification Code' },
  auth_sendCode:      { zh: '发送验证码',       en: 'Send Code' },
  auth_codeSent:      { zh: '已发送，请查收邮件', en: 'Sent! Check your email' },
  auth_resend:        { zh: '重新发送',         en: 'Resend' },

  // story
  story_create:            { zh: '新建故事',               en: 'New Story' },
  story_titleZh:           { zh: '故事标题（中文）',       en: 'Title (Chinese)' },
  story_titleEn:           { zh: '故事标题（英文，选填）', en: 'Title (English, optional)' },
  story_bgZh:              { zh: '故事背景（不超过40字）', en: 'Background (≤40 chars)' },
  story_bgEn:              { zh: '故事背景英文（选填，不超过80字）', en: 'Background English (optional, ≤80 chars)' },
  story_genre:             { zh: '类型',               en: 'Genre' },
  story_mystery:           { zh: '解谜推理',           en: 'Mystery' },
  story_numeric:           { zh: '数值选择',           en: 'Numeric Choice' },
  story_addChapter:        { zh: '添加章节',           en: 'Add Chapter' },
  story_outline:           { zh: '章节大纲（简短描述本章内容）', en: 'Chapter outline' },
  story_generate:          { zh: 'AI 生成',            en: 'Generate' },
  story_regenerate:        { zh: '重新生成',           en: 'Regenerate' },
  story_delete:            { zh: '删除',               en: 'Delete' },
  story_publish:           { zh: '发布本章',           en: 'Publish' },
  story_published:         { zh: '已发布',             en: 'Published' },
  story_noStories:         { zh: '还没有故事，创建第一个吧', en: 'No stories yet. Create one!' },
  story_status_draft:      { zh: '草稿',   en: 'Draft' },
  story_status_generating: { zh: '生成中', en: 'Generating' },
  story_status_published:  { zh: '已发布', en: 'Published' },
  story_center:            { zh: 'AI故事中心', en: 'AI Story Hub' },

  // reader
  reader_select:    { zh: '选择章节开始阅读', en: 'Select a chapter to start' },
  reader_locked:    { zh: '通关上一章解锁',   en: 'Complete previous chapter to unlock' },
  reader_done:      { zh: '已通关',           en: 'Completed' },
  reader_complete:  { zh: '完成本章',         en: 'Complete Chapter' },
  reader_chapters:  { zh: '章',              en: 'ch.' },

  // common
  common_loading: { zh: '加载中...', en: 'Loading...' },
  common_error:   { zh: '出错了',    en: 'Error occurred' },
} as const;

export type TranslationKey = keyof typeof translations;
export type Lang = 'zh' | 'en';
export type BilingualText = { zh: string; en: string };
