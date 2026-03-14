/**
 * Streaming parser for the stream-game XML format.
 *
 * Format produced by AI:
 *   <node>{"id":0,"type":"story","text":{"zh":"...","en":"..."}}</node>
 *   <meta>{"title":{...},"statDefs":{...},"itemDefs":{...}}</meta>
 *
 * Each complete element tag is a parse boundary — no need for a full SAX parser.
 * Robust against:
 *  - JSON values spanning multiple lines (fixJson normalises them)
 *  - Junk text outside tags (ignored)
 *  - False "</node>" inside JSON strings (retry logic)
 */

export interface XmlParsedElement {
  kind: 'node' | 'meta';
  data: any;
}

export class XmlStreamParser {
  private buffer = '';

  /** Feed a streaming chunk; returns any newly completed elements */
  feed(chunk: string): XmlParsedElement[] {
    this.buffer += chunk;
    return this.extract();
  }

  /** Call when AI stream ends to flush any remaining content */
  flush(): XmlParsedElement[] {
    const results = this.extract();
    this.buffer = '';
    return results;
  }

  private extract(): XmlParsedElement[] {
    const results: XmlParsedElement[] = [];
    let found = true;
    while (found) {
      found = false;
      for (const tag of ['node', 'meta'] as const) {
        const el = this.extractTag(tag);
        if (el !== null) {
          const parsed = this.parseJson(el.content);
          if (parsed !== null) results.push({ kind: tag, data: parsed });
          found = true;
          break; // restart scan from the new buffer position
        }
      }
    }
    return results;
  }

  private extractTag(tag: string): { content: string } | null {
    const open = `<${tag}>`;
    const close = `</${tag}>`;

    const startIdx = this.buffer.indexOf(open);
    if (startIdx === -1) return null;

    // Find the matching close tag; retry if inner JSON parse fails
    let searchFrom = startIdx + open.length;
    while (true) {
      const endIdx = this.buffer.indexOf(close, searchFrom);
      if (endIdx === -1) return null; // not complete yet

      const content = this.buffer.slice(startIdx + open.length, endIdx);
      const parsed = this.parseJson(content);
      if (parsed !== null) {
        // Successfully parsed — consume this element from the buffer
        this.buffer = this.buffer.slice(endIdx + close.length);
        return { content };
      }
      // JSON parse failed: false close tag inside a string value → look further
      searchFrom = endIdx + close.length;
    }
  }

  private parseJson(raw: string): any | null {
    let s = raw.trim();
    if (!s) return null;

    // Normalise bare newlines inside JSON strings (common in AI output)
    s = s.replace(/("(?:[^"\\]|\\.)*")/gs, m =>
      m.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    );

    // Strip stray control characters
    s = s.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, ' ');

    try {
      return JSON.parse(s);
    } catch {
      try {
        return JSON.parse(fixJson(s));
      } catch {
        return null;
      }
    }
  }
}

/** Repair common AI JSON mistakes (unescaped quotes inside strings) */
function fixJson(s: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { out += c; esc = false; continue; }
    if (c === '\\') { out += c; esc = true; continue; }
    if (c === '"') {
      if (!inStr) { inStr = true; out += c; continue; }
      let j = i + 1;
      while (j < s.length && ' \t\n\r'.includes(s[j])) j++;
      const next = s[j];
      if (!next || ':,}]'.includes(next)) { inStr = false; out += c; }
      else { out += '\\"'; }
      continue;
    }
    out += c;
  }
  return out;
}
