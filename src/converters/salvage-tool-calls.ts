import { sanitizeToolName } from "./shared.js";

// Gemini はマルチターンでツール履歴をテキストへ平坦化する (flattenToolHistory) 影響で、
// 直前のパターンを模倣して「ツール呼び出しをネイティブ functionCall ではなくテキスト(JSON)で出力」して
// しまうことがある。その場合 AI SDK はツール呼び出しと認識せず result.text に入ってしまうため、
// クライアントには JSON がそのまま返ってしまう。
// このモジュールは出力テキストから既知ツールのツール呼び出しを復元 (サルベージ) する。
// 誤検出を避けるため、name が既知ツール集合に含まれる場合のみ復元する。

export interface SalvagedToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface SalvageResult {
  // 復元したツール呼び出し (見つからなければ空配列)
  toolCalls: SalvagedToolCall[];
  // ツール呼び出し部分を取り除いた残りのテキスト
  text: string;
}

// 既知ツール名の集合を作る。モデルは宣言で見た名前 (サニタイズ後) と
// 平坦化履歴で見た名前 (オリジナル) のどちらでも出力しうるため両方を入れる。
export function buildKnownToolNames(names: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    set.add(n);
    set.add(sanitizeToolName(n));
  }
  return set;
}

// start から始まる { ... } の対応する閉じ括弧の位置を返す (文字列リテラル考慮)。見つからなければ -1。
function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') {
      inStr = true;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// テキスト中のトップレベル { ... } オブジェクトをすべて拾う。
function findJsonObjects(text: string): Array<{ json: string; start: number; end: number }> {
  const out: Array<{ json: string; start: number; end: number }> = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      const end = matchBrace(text, i);
      if (end !== -1) {
        out.push({ json: text.slice(i, end + 1), start: i, end: end + 1 });
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

// パース済みオブジェクトをツール呼び出しとして解釈する。name が既知でなければ null。
// よくある包み方をすべて吸収する: {name,args} / {name,arguments} / {tool,parameters} /
// {function:{name,arguments}} / {functionCall:{name,args}} など。
function interpretToolObject(obj: unknown, known: Set<string>): SalvagedToolCall | null {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  // ネストした包み (Gemini / OpenAI 形式) を再帰的にほどく
  if (o.functionCall && typeof o.functionCall === "object") return interpretToolObject(o.functionCall, known);
  if (o.function_call && typeof o.function_call === "object") return interpretToolObject(o.function_call, known);
  if (o.function && typeof o.function === "object") return interpretToolObject(o.function, known);

  const rawName = o.name ?? o.tool ?? o.tool_name ?? o.toolName ?? o.function ?? o.recipient_name;
  if (typeof rawName !== "string") return null;
  const name = rawName.replace(/^default_api\./, "").trim();
  if (!known.has(name)) return null;

  let args: unknown = o.args ?? o.arguments ?? o.parameters ?? o.input ?? o.tool_input ?? {};
  if (typeof args === "string") {
    try { args = JSON.parse(args); } catch { args = {}; }
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) args = {};
  return { name, args: args as Record<string, unknown> };
}

// 出力テキストから既知ツールのツール呼び出しを復元する。
export function salvageToolCallsFromText(text: string, known: Set<string>): SalvageResult {
  if (!text || known.size === 0) return { toolCalls: [], text };

  const spans: Array<[number, number]> = [];
  const calls: SalvagedToolCall[] = [];
  const consumedJsonStart = new Set<number>();

  // 1) 平坦化フォーマット [Tool Use: NAME] { ... } の echo を最優先で拾う
  const markerRe = /\[Tool Use:\s*([^\]\n]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text)) !== null) {
    const name = m[1].trim();
    let j = markerRe.lastIndex;
    while (j < text.length && /\s/.test(text[j]!)) j++;
    if (text[j] === "{") {
      const end = matchBrace(text, j);
      if (end !== -1) {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(text.slice(j, end + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) args = parsed as Record<string, unknown>;
        } catch { /* 引数が壊れていても呼び出し自体は復元する */ }
        if (known.has(name)) {
          calls.push({ name, args });
          spans.push([m.index, end + 1]);
          consumedJsonStart.add(j);
        }
        continue;
      }
    }
    // 引数 JSON が続かないマーカーでも、既知ツールなら空引数で復元する
    if (known.has(name)) {
      calls.push({ name, args: {} });
      spans.push([m.index, markerRe.lastIndex]);
    }
  }

  // 2) コードフェンス内・素の JSON オブジェクトでツール呼び出し形のものを拾う
  for (const obj of findJsonObjects(text)) {
    if (consumedJsonStart.has(obj.start)) continue;
    if (spans.some(([s, e]) => obj.start < e && obj.end > s)) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(obj.json); } catch { continue; }
    const call = interpretToolObject(parsed, known);
    if (call) {
      calls.push(call);
      spans.push([obj.start, obj.end]);
    }
  }

  if (calls.length === 0) return { toolCalls: [], text };

  // 復元したスパンを取り除いて残りテキストを得る
  spans.sort((a, b) => a[0] - b[0]);
  let residual = "";
  let pos = 0;
  for (const [s, e] of spans) {
    if (s < pos) continue; // 念のため重複スパンをスキップ
    residual += text.slice(pos, s);
    pos = e;
  }
  residual += text.slice(pos);
  // 取り残されたコードフェンスを除去する
  residual = residual.replace(/```(?:json|tool_code|tool_call|tool)?/gi, "").trim();

  return { toolCalls: calls, text: residual };
}

// ストリーミング時、先頭テキストがツール呼び出し (JSON / [Tool Use:] / コードフェンス) の
// 始まりかを判定する。'undecided' はまだ判断材料が足りない状態 (バッファして待つ)。
export function classifyStreamStart(text: string): "tool" | "text" | "undecided" {
  const t = text.replace(/^\s+/, "");
  if (t === "") return "undecided";
  if (t.startsWith("[Tool Use:")) return "tool";
  if (t.startsWith("[")) {
    // "[Tool Use:" の途中かもしれないので、確定するまで待つ
    return "[Tool Use:".startsWith(t) ? "undecided" : "text";
  }
  if (t.startsWith("{")) return "tool";
  if (t.startsWith("```")) {
    const nl = t.indexOf("\n");
    const lang = (nl === -1 ? t : t.slice(0, nl)).slice(3).trim().toLowerCase();
    if (nl === -1 && lang === "") return "undecided"; // 言語タグ待ち
    return lang.startsWith("json") || lang.startsWith("tool") ? "tool" : "text";
  }
  if ("```".startsWith(t)) return "undecided"; // フェンスの途中
  return "text";
}
