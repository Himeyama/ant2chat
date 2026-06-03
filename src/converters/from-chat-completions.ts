import type {
  AnthropicMessage,
  AnthropicTool,
  AnthropicToolChoice,
  ContentBlock,
} from "../types/anthropic.js";
import type {
  ChatMessage,
  ChatContentPart,
  ChatTool,
  ChatToolChoice,
} from "../types/openai-chat.js";

function safeParseArgs(args: string | undefined): unknown {
  try {
    return JSON.parse(args || "{}");
  } catch {
    return {};
  }
}

function textOf(content: ChatMessage["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content
    .filter((p): p is Extract<ChatContentPart, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// data:image/png;base64,xxxx を Anthropic の base64 ソースへ分解する
function parseDataUrl(url: string): { media_type: string; data: string } | null {
  const m = url.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  return { media_type: m[1], data: m[2] };
}

function userContentToBlocks(content: ChatMessage["content"]): string | ContentBlock[] {
  if (content == null) return "";
  if (typeof content === "string") return content;
  const hasImage = content.some((p) => p.type === "image_url");
  if (!hasImage) return textOf(content);

  const blocks: ContentBlock[] = [];
  for (const part of content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text });
    } else if (part.type === "image_url") {
      const url = part.image_url.url;
      const data = parseDataUrl(url);
      blocks.push(
        data
          ? { type: "image", source: { type: "base64", media_type: data.media_type, data: data.data } }
          : { type: "image", source: { type: "url", url } }
      );
    }
  }
  return blocks;
}

// Chat Completions のメッセージ配列を Anthropic 形式へ変換する。
// system / developer は system 文字列にまとめ、tool ロールは直前の tool_result
// ユーザーメッセージに合流させる (Anthropic は tool_result を user メッセージに入れるため)。
export function chatMessagesToAnthropic(
  messages: ChatMessage[]
): { system?: string; messages: AnthropicMessage[] } {
  const systemParts: string[] = [];
  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
      case "developer": {
        const text = textOf(msg.content);
        if (text) systemParts.push(text);
        break;
      }
      case "user": {
        result.push({ role: "user", content: userContentToBlocks(msg.content) });
        break;
      }
      case "assistant": {
        const blocks: ContentBlock[] = [];
        const text = textOf(msg.content);
        if (text) blocks.push({ type: "text", text });
        for (const tc of msg.tool_calls ?? []) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: safeParseArgs(tc.function.arguments),
          });
        }
        result.push({ role: "assistant", content: blocks.length > 0 ? blocks : text });
        break;
      }
      case "tool": {
        const block: ContentBlock = {
          type: "tool_result",
          tool_use_id: msg.tool_call_id ?? "",
          content: textOf(msg.content),
        };
        const last = result[result.length - 1];
        if (
          last &&
          last.role === "user" &&
          Array.isArray(last.content) &&
          last.content.every((b) => b.type === "tool_result")
        ) {
          (last.content as ContentBlock[]).push(block);
        } else {
          result.push({ role: "user", content: [block] });
        }
        break;
      }
    }
  }

  const system = systemParts.join("\n");
  return { system: system || undefined, messages: result };
}

export function chatToolsToAnthropic(tools: ChatTool[] | undefined): AnthropicTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: AnthropicTool[] = [];
  for (const t of tools) {
    const fn = t?.function;
    if (!fn?.name) continue;
    out.push({
      name: fn.name,
      description: fn.description,
      input_schema: (fn.parameters ?? { type: "object", properties: {} }) as Record<string, unknown>,
    });
  }
  return out.length > 0 ? out : undefined;
}

export function chatToolChoiceToAnthropic(
  choice: ChatToolChoice | undefined
): AnthropicToolChoice | undefined {
  if (choice === undefined) return undefined;
  if (choice === "auto") return { type: "auto" };
  if (choice === "none") return { type: "none" };
  if (choice === "required") return { type: "any" };
  if (typeof choice === "object" && choice.type === "function") {
    return { type: "tool", name: choice.function.name };
  }
  return undefined;
}
