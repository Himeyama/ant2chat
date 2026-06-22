// フルスクリーン TUI ログビューア — マウスクリックで会話ログを折りたたみ表示

import { config } from "./config.js";
import { onFinishLog, type LogEntry } from "./log-store.js";

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  red:     "\x1b[31m",
} as const;

function hl(json: string): string {
  return json.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, keyword, number) => {
      if (str && colon) return `${C.cyan}${str}${C.reset}${colon}`;
      if (str)          return `${C.green}${str}${C.reset}`;
      if (keyword)      return `${C.yellow}${keyword}${C.reset}`;
      if (number)       return `${C.blue}${number}${C.reset}`;
      return match;
    }
  );
}

interface AnthropicMessage {
  role?: string;
  content?: unknown;
}

function formatContent(content: unknown, maxLen = 120): string {
  if (typeof content === "string") {
    return content.length > maxLen ? content.slice(0, maxLen) + "…" : content;
  }
  if (!Array.isArray(content)) return JSON.stringify(content).slice(0, maxLen);

  const parts: string[] = [];
  for (const block of content as { type?: string; text?: string; name?: string; content?: unknown }[]) {
    switch (block.type) {
      case "text":
        parts.push(block.text?.slice(0, maxLen) ?? "");
        break;
      case "tool_use":
        parts.push(`${C.magenta}[tool_use: ${block.name}]${C.reset}`);
        break;
      case "tool_result": {
        const r = typeof block.content === "string" ? block.content.slice(0, 60) : "[result]";
        parts.push(`${C.yellow}[tool_result: ${r}]${C.reset}`);
        break;
      }
      case "thinking":
        parts.push(`${C.dim}[thinking…]${C.reset}`);
        break;
      case "redacted_thinking":
        parts.push(`${C.dim}[redacted_thinking]${C.reset}`);
        break;
      case "image":
        parts.push(`${C.dim}[image]${C.reset}`);
        break;
      default:
        parts.push(JSON.stringify(block).slice(0, 60));
    }
  }
  const joined = parts.join(" | ");
  return joined.length > maxLen ? joined.slice(0, maxLen) + "…" : joined;
}

type EntryKind = "request" | "response";

interface Entry {
  kind: EntryKind;
  label: string;
  data: Record<string, unknown>;
  expanded: boolean;
}

const MAX_ENTRIES = 200;

class TuiLog {
  private entries: Entry[] = [];
  private bannerLines: string[] = [];
  private started = false;
  private isTTY: boolean;
  private headerRows: number[] = [];
  private scrollOffset = 0; // 0 = 最新表示、正 = その分だけ上にスクロール

  constructor() {
    this.isTTY = Boolean(process.stdout.isTTY);
  }

  private start() {
    if (this.started || !this.isTTY) return;
    this.started = true;

    process.stdout.write("\x1b[?1049h");  // オルタネートスクリーンバッファへ切替
    process.stdout.write("\x1b[2J\x1b[H"); // 画面クリア & カーソルをホームへ
    process.stdout.write("\x1b[?25l");    // カーソル非表示
    process.stdout.write("\x1b[?1000h"); // マウスボタンイベント有効
    process.stdout.write("\x1b[?1006h"); // SGR 拡張モード

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("data", (buf: Buffer) => this.handleInput(buf));
    process.stdout.on("resize", () => this.render());

    const cleanup = () => { this.cleanup(); process.exit(0); };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // finishLog フックを登録
    onFinishLog((entry) => this.addResponse(entry));
  }

  setBanner(lines: string[]) {
    this.bannerLines = lines;
    if (this.isTTY && config.tuiLog) {
      this.start();
      this.render();
    }
  }

  addRequest(summary: Record<string, unknown>) {
    if (!this.isTTY || !config.tuiLog) {
      process.stdout.write(hl(JSON.stringify(summary, null, 2)) + "\n");
      return;
    }

    this.start();

    const now = new Date();
    const time = now.toTimeString().slice(0, 8);
    const model = String(summary.model ?? "?");
    const stream = summary.stream ? `${C.cyan}stream${C.reset}` : `${C.dim}sync${C.reset}`;
    const endpoint = String(summary.endpoint ?? "/v1/messages");

    const msgs = Array.isArray(summary.messages)
      ? summary.messages.length
      : typeof summary.messages === "number"
      ? summary.messages
      : undefined;
    const msgStr = msgs !== undefined ? ` ${C.dim}msgs:${C.reset}${msgs}` : "";

    const toolCount = Array.isArray(summary.tools) ? summary.tools.length : 0;
    const toolStr = toolCount > 0 ? ` ${C.dim}tools:${C.reset}${toolCount}` : "";

    const label = `${C.dim}${time}${C.reset} ${C.bold}${C.cyan}▸${C.reset} ${C.bold}${endpoint}${C.reset} │ ${C.yellow}${model}${C.reset} │ ${stream}${msgStr}${toolStr}`;

    this.pushEntry({ kind: "request", label, data: summary, expanded: false });
    this.render();
  }

  private addResponse(entry: LogEntry) {
    if (!this.isTTY) return;

    const time = new Date(entry.timestamp + entry.durationMs).toTimeString().slice(0, 8);
    const secStr = (entry.durationMs / 1000).toFixed(2) + "s";

    const tokStr = [
      entry.inputTokens > 0 ? `in:${entry.inputTokens}` : null,
      entry.inputCacheTokens > 0 ? `cache:${entry.inputCacheTokens}` : null,
      entry.outputTokens > 0 ? `out:${entry.outputTokens}` : null,
    ].filter(Boolean).join(" ");

    let label: string;
    if (entry.status === "error") {
      const errSnippet = (entry.error ?? "error").slice(0, 60);
      label = `${C.dim}${time}${C.reset} ${C.bold}${C.red}◂${C.reset} ${C.bold}${entry.endpoint}${C.reset} │ ${C.red}error${C.reset}: ${errSnippet} │ ${C.dim}${secStr}${C.reset}`;
    } else {
      const stop = entry.response?.stopReason ?? "ok";
      const stopColor = stop === "end_turn" || stop === "stop" ? C.green : stop === "tool_use" || stop === "tool_calls" ? C.magenta : C.yellow;
      label = `${C.dim}${time}${C.reset} ${C.bold}${C.green}◂${C.reset} ${C.bold}${entry.endpoint}${C.reset} │ ${stopColor}${stop}${C.reset} │ ${C.dim}${tokStr}${C.reset} │ ${C.dim}${secStr}${C.reset}`;
    }

    const data: Record<string, unknown> = {
      status: entry.status,
      stopReason: entry.response?.stopReason,
      inputTokens: entry.inputTokens || undefined,
      inputCacheTokens: entry.inputCacheTokens || undefined,
      outputTokens: entry.outputTokens || undefined,
      durationMs: entry.durationMs,
      text: entry.response?.text,
      toolCalls: entry.response?.toolCalls,
      error: entry.error,
    };

    this.pushEntry({ kind: "response", label, data, expanded: false });
    this.render();
  }

  private pushEntry(entry: Entry) {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
      if (this.scrollOffset > 0) this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    } else if (this.scrollOffset > 0) {
      // スクロール中: 新エントリ (常に折りたたみ = 1行) 分だけオフセットを補正して表示位置を維持
      this.scrollOffset++;
    }
  }

  private scrollBy(delta: number) {
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
    this.render();
  }

  private handleInput(buf: Buffer) {
    const s = buf.toString();

    if (s === "\x03" || s === "q") {
      this.cleanup();
      process.exit(0);
    }

    // キーボードスクロール (行単位)
    const pageSize = Math.max(1, (process.stdout.rows ?? 24) - 4);
    if (s === "\x1b[A" || s === "k") return this.scrollBy(1);          // ↑ 1行
    if (s === "\x1b[B" || s === "j") return this.scrollBy(-1);         // ↓ 1行
    if (s === "\x1b[5~")             return this.scrollBy(pageSize);   // PageUp
    if (s === "\x1b[6~")             return this.scrollBy(-pageSize);  // PageDown
    if (s === "g")                   { this.scrollOffset = Number.MAX_SAFE_INTEGER; return this.render(); } // 先頭へ
    if (s === "G")                   { this.scrollOffset = 0; return this.render(); } // 末尾へ

    // SGR マウスイベント: \x1b[<btn;col;rowM (押下) / m (離す)
    const m = s.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
    if (!m || m[4] !== "M") return;
    const btn = parseInt(m[1]);
    if (btn === 0)  this.onClick(parseInt(m[3]));  // 左クリック
    if (btn === 64) this.scrollBy(3);              // ホイール上
    if (btn === 65) this.scrollBy(-3);             // ホイール下
  }

  private onClick(clickRow: number) {
    const idx = this.headerRows.indexOf(clickRow);
    if (idx !== -1) {
      this.entries[idx].expanded = !this.entries[idx].expanded;
      this.render();
    }
  }

  private render() {
    const termRows = process.stdout.rows ?? 24;
    const bannerHeight = this.bannerLines.length > 0 ? this.bannerLines.length + 1 : 0;
    const availRows = termRows - 1 - bannerHeight;

    // 全エントリをフラットな行リストへ展開
    interface RLine { text: string; entryIdx: number; isHeader: boolean; }
    const allLines: RLine[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const marker = entry.expanded ? `${C.cyan}▼${C.reset}` : `${C.dim}▶${C.reset}`;
      allLines.push({ text: `${marker} ${entry.label}`, entryIdx: i, isHeader: true });
      if (entry.expanded) {
        const lines = entry.kind === "request"
          ? this.formatRequest(entry.data)
          : this.formatResponse(entry.data);
        for (const line of lines) {
          allLines.push({ text: `  ${line}`, entryIdx: i, isHeader: false });
        }
        allLines.push({ text: "", entryIdx: i, isHeader: false }); // 空行
      }
    }

    // scrollOffset を行数でクランプ
    const maxScroll = Math.max(0, allLines.length - availRows);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);

    // 表示する行スライスを決定
    const visibleEnd = allLines.length - this.scrollOffset;
    const visibleStart = Math.max(0, visibleEnd - availRows);
    const visibleLines = allLines.slice(visibleStart, visibleEnd);

    const out: string[] = ["\x1b[2J\x1b[H"];
    let row = 1;

    // バナー固定表示
    for (const line of this.bannerLines) {
      out.push(`\x1b[${row};1H${C.dim}${line}${C.reset}`);
      row++;
    }
    if (this.bannerLines.length > 0) {
      const termCols = process.stdout.columns ?? 80;
      out.push(`\x1b[${row};1H${C.dim}${"─".repeat(termCols)}${C.reset}`);
      row++;
    }

    this.headerRows = new Array(this.entries.length).fill(-1);

    for (const rline of visibleLines) {
      if (rline.isHeader) this.headerRows[rline.entryIdx] = row;
      out.push(`\x1b[${row};1H${rline.text}`);
      row++;
    }

    // ヘルプ行 (最下行)
    const scrollInfo = this.scrollOffset > 0
      ? ` ${C.yellow}[↑${this.scrollOffset}行]${C.reset}` : "";
    out.push(`\x1b[${termRows};1H${C.dim}↑↓/ホイール: スクロール  クリック: 展開  g/G: 先頭/末尾  q: 終了${C.reset}${scrollInfo}`);

    process.stdout.write(out.join(""));
  }

  private formatRequest(data: Record<string, unknown>): string[] {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      if (key === "messages" && Array.isArray(value)) {
        lines.push(`${C.cyan}"messages"${C.reset}: [`);
        for (let i = 0; i < (value as AnthropicMessage[]).length; i++) {
          const msg = value[i] as AnthropicMessage;
          const role = msg.role ?? "?";
          const roleColor = role === "user" ? C.green : role === "assistant" ? C.yellow : C.dim;
          const text = formatContent(msg.content);
          lines.push(`  ${C.dim}[${i}]${C.reset} ${roleColor}${role}${C.reset}: ${text}`);
        }
        lines.push("]");
      } else if (Array.isArray(value)) {
        const items = (value as unknown[]).map(v => `${C.green}"${v}"${C.reset}`).join(", ");
        lines.push(`${C.cyan}"${key}"${C.reset}: [${items}]`);
      } else if (typeof value === "boolean") {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${C.yellow}${value}${C.reset}`);
      } else if (typeof value === "number") {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${C.blue}${value}${C.reset}`);
      } else if (value !== null && typeof value === "object") {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${hl(JSON.stringify(value))}`);
      } else {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${C.green}"${value}"${C.reset}`);
      }
    }

    return lines;
  }

  private formatResponse(data: Record<string, unknown>): string[] {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) continue;

      if (key === "toolCalls" && Array.isArray(value)) {
        lines.push(`${C.cyan}"toolCalls"${C.reset}: [`);
        for (const tc of value as { name: string; arguments: string }[]) {
          lines.push(`  ${C.magenta}${tc.name}${C.reset}: ${tc.arguments.slice(0, 120)}`);
        }
        lines.push("]");
      } else if (key === "text" && typeof value === "string") {
        const preview = value.slice(0, 200);
        lines.push(`${C.cyan}"text"${C.reset}: ${C.green}"${preview}${value.length > 200 ? "…" : ""}"${C.reset}`);
      } else if (key === "durationMs" && typeof value === "number") {
        lines.push(`${C.cyan}"duration"${C.reset}: ${C.blue}${(value / 1000).toFixed(3)}s${C.reset}`);
      } else if (typeof value === "boolean") {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${C.yellow}${value}${C.reset}`);
      } else if (typeof value === "number") {
        lines.push(`${C.cyan}"${key}"${C.reset}: ${C.blue}${value}${C.reset}`);
      } else if (typeof value === "string") {
        const statusColor = key === "status" && value === "error" ? C.red
          : key === "status" ? C.green
          : key === "stopReason" ? C.magenta
          : C.green;
        lines.push(`${C.cyan}"${key}"${C.reset}: ${statusColor}"${value}"${C.reset}`);
      }
    }

    return lines;
  }

  cleanup() {
    if (!this.started) return;
    process.stdout.write("\x1b[?1000l\x1b[?1006l"); // マウス無効
    process.stdout.write("\x1b[?25h");               // カーソル再表示
    process.stdout.write("\x1b[?1049l");             // メインバッファへ戻す
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(false); } catch {}
    }
    // 終了時: バナー → 全エントリを折りたたみ状態で出力
    for (const line of this.bannerLines) {
      process.stdout.write(line + "\r\n");
    }
    if (this.bannerLines.length > 0 && this.entries.length > 0) {
      process.stdout.write("\r\n");
    }
    for (const entry of this.entries) {
      process.stdout.write(entry.label + "\r\n");
    }
  }
}

export const tuiLog = new TuiLog();
