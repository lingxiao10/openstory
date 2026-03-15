import fs from 'fs';
import path from 'path';
import { config } from './config';

const logsDir = path.join(__dirname, '../../../logs');
const mainLog = path.join(logsDir, 'generate.log');

try { fs.mkdirSync(logsDir, { recursive: true }); } catch {}

function write(file: string, level: string, msg: string) {
  const line = `${new Date().toISOString()} [${level}] ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(file, line); } catch {}
}

// 全局日志（章节生成流程）
export const logger = {
  info:  (msg: string) => write(mainLog, 'INFO', msg),
  error: (msg: string) => write(mainLog, 'ERROR', msg),
};

// 每次 AI stream 请求独立日志文件
export function createStreamLogger(tag: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(logsDir, `stream-${ts}-${tag}.log`);
  return {
    info:  (msg: string) => write(file, 'INFO', msg),
    error: (msg: string) => write(file, 'ERROR', msg),
    file,
  };
}

// Prompt 文件日志（统一管理读写，受 config.promptLogEnabled 控制）
const promptLogsDir = path.join(__dirname, '../../logs');

export const promptLogger = {
  /** 写入 prompt 到独立文件，返回文件路径（未写入时返回 null） */
  write(genre: string, chapterNum: number, content: string): string | null {
    if (!config.promptLogEnabled) return null;
    try {
      if (!fs.existsSync(promptLogsDir)) fs.mkdirSync(promptLogsDir, { recursive: true });
      const file = path.join(promptLogsDir, `prompt_${genre}_ch${chapterNum}_${Date.now()}.txt`);
      fs.writeFileSync(file, content, 'utf-8');
      return file;
    } catch (e) {
      logger.error(`[PromptLogger] write failed: ${e}`);
      return null;
    }
  },

  /** 读取指定 prompt 文件内容 */
  read(filePath: string): string | null {
    if (!config.promptLogEnabled) return null;
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      logger.error(`[PromptLogger] read failed: ${e}`);
      return null;
    }
  },

  /** 列出所有 prompt 日志文件路径 */
  list(): string[] {
    try {
      if (!fs.existsSync(promptLogsDir)) return [];
      return fs.readdirSync(promptLogsDir)
        .filter(f => f.startsWith('prompt_'))
        .map(f => path.join(promptLogsDir, f));
    } catch {
      return [];
    }
  },
};
