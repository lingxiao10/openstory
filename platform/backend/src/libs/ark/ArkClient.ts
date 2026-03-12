// ============================================================
// ArkClient.ts — 火山引擎 Ark（豆包）API 独立客户端
// 零依赖，可直接复制到任何 TypeScript/Node.js 项目使用
// ============================================================

// ── 类型定义 ────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ArkCallResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** 粗略估算费用（USD），基于内置定价表 */
  costUsd: number;
}

export interface ArkCallOptions {
  /** 超时毫秒数，默认 30000 */
  timeoutMs?: number;
  /** 最大输出 token 数，默认 512 */
  maxTokens?: number;
  /** 温度，默认 0.7 */
  temperature?: number;
  /**
   * thinking 参数（豆包 seed 系列模型专属）
   * - "disabled"（推荐）：关闭深度思考，响应更快、更省 token
   * - "enabled"：开启深度思考
   * - "auto"：模型自动决定
   * 默认 "disabled"
   */
  thinking?: "disabled" | "enabled" | "auto";
}

// ── 常量 ────────────────────────────────────────────────────

export const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** 豆包 seed 系列模型（2026-03） */
export const ARK_MODELS = {
  SEED_2_0_PRO:  "doubao-seed-2-0-pro-260215",
  SEED_2_0_LITE: "doubao-seed-2-0-lite-260215",
  SEED_2_0_MINI: "doubao-seed-2-0-mini-260215",  // 最便宜，推荐免费场景
  SEED_1_8:      "doubao-seed-1-8-251228",
  DEEPSEEK_V3:   "deepseek-v3-2-251201",
} as const;

export type ArkModel = typeof ARK_MODELS[keyof typeof ARK_MODELS];

// ── 定价（USD / 1M tokens，仅供参考，以官方为准） ──────────

const PRICING: Record<string, { input: number; output: number }> = {
  [ARK_MODELS.SEED_2_0_PRO]:  { input: 0.04,  output: 0.20 },
  [ARK_MODELS.SEED_2_0_LITE]: { input: 0.02,  output: 0.10 },
  [ARK_MODELS.SEED_2_0_MINI]: { input: 0.01,  output: 0.05 },
  [ARK_MODELS.SEED_1_8]:      { input: 0.015, output: 0.07 },
  [ARK_MODELS.DEEPSEEK_V3]:   { input: 0.02,  output: 0.06 },
};

// ── 主客户端类 ───────────────────────────────────────────────

export class ArkClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * @param apiKey  火山引擎 Ark API Key
   * @param baseUrl 可选，自定义 base URL（默认 ARK_BASE_URL）
   */
  constructor(apiKey: string, baseUrl = ARK_BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * 发起 chat 请求
   * @param model    模型 ID，推荐使用 ARK_MODELS 常量
   * @param messages 对话消息列表
   * @param options  可选配置（超时、温度、thinking 等）
   */
  async chat(
    model: string,
    messages: ChatMessage[],
    options: ArkCallOptions = {}
  ): Promise<ArkCallResult> {
    const {
      timeoutMs = 30000,
      maxTokens = 512,
      temperature = 0.7,
      thinking = "disabled",
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let json: {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          thinking: { type: thinking },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ark API error ${res.status}: ${text}`);
      }

      json = await res.json() as typeof json;
    } finally {
      clearTimeout(timer);
    }

    const content = json.choices?.[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const pricing = PRICING[model] ?? { input: 0.02, output: 0.10 };

    return {
      content,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: (usage.prompt_tokens * pricing.input + usage.completion_tokens * pricing.output) / 1_000_000,
    };
  }

  /**
   * 流式 chat，逐 chunk 回调，返回完整内容字符串
   * @param onChunk 每收到新内容时调用（参数为本次增量文本）
   */
  async chatStream(
    model: string,
    messages: ChatMessage[],
    options: ArkCallOptions & { onChunk?: (delta: string, total: string) => void } = {}
  ): Promise<string> {
    const {
      timeoutMs = 30000,
      maxTokens = 512,
      temperature = 0.7,
      thinking = "disabled",
      onChunk,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          thinking: { type: thinking },
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ark API error ${res.status}: ${text}`);
      }

      if (!res.body) throw new Error("No response body for streaming");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              full += delta;
              onChunk?.(delta, full);
            }
          } catch { /* ignore malformed chunk */ }
        }
      }

      return full;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 快捷方法：单轮问答（system + user）
   * @param model       模型 ID
   * @param systemPrompt 系统提示词
   * @param userPrompt   用户输入
   * @param options      可选配置
   */
  async ask(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    options: ArkCallOptions = {}
  ): Promise<ArkCallResult> {
    return this.chat(
      model,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      options
    );
  }
}
