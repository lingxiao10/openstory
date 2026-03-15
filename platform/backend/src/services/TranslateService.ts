import { config } from '../config';

export interface TranslateResult {
  zh: string;
  en: string;
  sourceLang: 'zh' | 'en';
}

export class TranslateService {
  /**
   * Detect source language, return both zh and en versions.
   * Exactly one of zh/en will be the original, the other translated.
   */
  static async detectAndTranslate(text: string): Promise<TranslateResult> {
    const prompt = `Detect whether the following text is in Chinese (zh) or English (en), then translate it to the other language.

Text:
"""
${text}
"""

Reply with only valid JSON, no markdown fences:
{"sourceLang":"zh or en","translation":"translated text here"}`;

    const raw = await TranslateService.call(prompt);

    let parsed: { sourceLang: 'zh' | 'en'; translation: string };
    try {
      // Strip any accidental markdown fences
      const clean = raw.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Fallback: detect by Unicode range
      const isChinese = /[\u4e00-\u9fff]/.test(text);
      return {
        zh: isChinese ? text : raw,
        en: isChinese ? raw : text,
        sourceLang: isChinese ? 'zh' : 'en',
      };
    }

    const { sourceLang, translation } = parsed;
    return {
      zh: sourceLang === 'zh' ? text : translation,
      en: sourceLang === 'en' ? text : translation,
      sourceLang,
    };
  }

  private static async call(prompt: string): Promise<string> {
    const res = await fetch(`${config.translate.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.translate.apiKey}`,
      },
      body: JSON.stringify({
        model: config.translate.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`TranslateService API error: ${err}`);
    }

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content?.trim() || '';
  }
}
