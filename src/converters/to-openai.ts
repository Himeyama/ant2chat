import { jsonSchema, type CoreMessage, type ImagePart, type TextPart, type ToolSet } from "ai";
import type {
  AnthropicMessage,
  AnthropicTool,
  AnthropicToolChoice,
  ContentBlock,
  ContentBlockImage,
  ContentBlockText,
  SystemBlock,
} from "../types/anthropic.js";

function imageBlockToPart(block: ContentBlockImage): ImagePart {
  const { source } = block;
  if (source.type === "base64") {
    return { type: "image", image: source.data, mimeType: source.media_type };
  }
  return { type: "image", image: new URL(source.url) };
}

function userBlocksToParts(blocks: ContentBlock[]): string | Array<TextPart | ImagePart> {
  const hasImage = blocks.some((b) => b.type === "image");
  if (!hasImage) {
    return blocks
      .filter((b): b is ContentBlockText => b.type === "text")
      .map((b) => b.text)
      .join("");
  }
  const parts: Array<TextPart | ImagePart> = [];
  for (const block of blocks) {
    if (block.type === "text") {
      parts.push({ type: "text", text: block.text });
    } else if (block.type === "image") {
      parts.push(imageBlockToPart(block));
    }
  }
  return parts;
}

function systemToString(system: string | SystemBlock[]): string {
  if (typeof system === "string") return system;
  return system.map((b) => b.text).join("\n");
}

function toolResultContentToString(content: string | ContentBlockText[]): string {
  if (typeof content === "string") return content;
  return content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

export function toOpenAIMessages(
  messages: AnthropicMessage[],
  system?: string | SystemBlock[]
): CoreMessage[] {
  const result: CoreMessage[] = [];

  if (system) {
    result.push({ role: "system", content: systemToString(system) });
  }

  for (const msg of messages) {
    const content = msg.content;

    if (typeof content === "string") {
      result.push({ role: msg.role, content });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Array<
        | { type: "text"; text: string }
        | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
      > = [];
      for (const block of content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          parts.push({
            type: "tool-call",
            toolCallId: block.id,
            toolName: block.name,
            args: block.input ?? {},
          });
        }
        // thinking / redacted_thinking はスキップ（upstream に送らない）
      }
      if (parts.length === 0) {
        parts.push({ type: "text", text: "" });
      }
      result.push({ role: "assistant", content: parts });
      continue;
    }

    // user role
    const toolResults = content.filter((b) => b.type === "tool_result");
    const textBlocks = content.filter((b) => b.type === "text" || b.type === "image");

    if (toolResults.length > 0) {
      result.push({
        role: "tool",
        content: toolResults.map((b) => {
          const tr = b as Extract<ContentBlock, { type: "tool_result" }>;
          return {
            type: "tool-result",
            toolCallId: tr.tool_use_id,
            toolName: "",
            result: toolResultContentToString(tr.content),
            isError: tr.is_error,
          };
        }),
      });
    }

    if (textBlocks.length > 0) {
      result.push({ role: "user", content: userBlocksToParts(textBlocks as ContentBlock[]) });
    }
  }

  return result;
}

export function toOpenAITools(tools: AnthropicTool[] | undefined): ToolSet | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: ToolSet = {};
  for (const t of tools) {
    // $schema は多くの OpenAI 互換エンドポイントが拒否するため除去する
    const { $schema, ...schema } = t.input_schema as Record<string, unknown> & { $schema?: unknown };
    void $schema;
    out[t.name] = {
      description: t.description,
      parameters: jsonSchema(schema as Parameters<typeof jsonSchema>[0]),
    };
  }
  return out;
}

export function toOpenAIToolChoice(
  choice: AnthropicToolChoice | undefined
):
  | "auto"
  | "none"
  | "required"
  | { type: "tool"; toolName: string }
  | undefined {
  if (!choice) return undefined;
  switch (choice.type) {
    case "auto":
      return "auto";
    case "any":
      return "required";
    case "none":
      return "none";
    case "tool":
      return { type: "tool", toolName: choice.name };
  }
}
