import fs from 'fs';
import path from 'path';

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
