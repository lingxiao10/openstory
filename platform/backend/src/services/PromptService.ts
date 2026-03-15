import fs from 'fs';
import path from 'path';

const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

function loadFile(filename: string): string {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf-8');
}

export interface PromptVars {
  title: string;
  background: string;
  chapterProgress: string;
  outline: string;                   // e.g. "本章大纲：xxx" or "故事主线：xxx"
  endingInstruction: string;
  playerPrompt: string;              // "\n玩家角色：xxx" or ""
  prevContext: string;               // "\n前情摘要：xxx\n" or ""
  firstChapterInstruction: string;   // 第1章背景描述要求，其余章节为空字符串
}

function render(template: string, vars: PromptVars & { sharePrompt: string }): string {
  return template
    .replace(/\{\{share_prompt\}\}/g, vars.sharePrompt)
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{background\}\}/g, vars.background)
    .replace(/\{\{chapter_progress\}\}/g, vars.chapterProgress)
    .replace(/\{\{outline\}\}/g, vars.outline)
    .replace(/\{\{ending_instruction\}\}/g, vars.endingInstruction)
    .replace(/\{\{player_prompt\}\}/g, vars.playerPrompt)
    .replace(/\{\{prev_context\}\}/g, vars.prevContext)
    .replace(/\{\{first_chapter_instruction\}\}/g, vars.firstChapterInstruction);
}

export class PromptService {
  /** 实时从磁盘加载并渲染推理解谜提示词 */
  static buildMysteryPrompt(vars: PromptVars): string {
    const sharePrompt = loadFile('share_prompt.md');
    const template = loadFile('mystery.md');
    return render(template, { ...vars, sharePrompt });
  }

  /** 实时从磁盘加载并渲染数值冒险提示词 */
  static buildNumericPrompt(vars: PromptVars): string {
    const sharePrompt = loadFile('share_prompt.md');
    const template = loadFile('numeric.md');
    return render(template, { ...vars, sharePrompt });
  }
}
