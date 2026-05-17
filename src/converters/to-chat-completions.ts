import { jsonSchema, type ToolSet } from "ai";
import type { AnthropicTool } from "../types/anthropic.js";
import { sanitizeToolName } from "./shared.js";

// Chat Completions API が許可しない JSON Schema キーワード（format は値によらず常に除去）
const DISALLOWED_KEYWORDS = new Set([
  "propertyNames", "if", "then", "else", "not", "contains", "patternProperties", "format",
]);

// strict モード: 全オブジェクトに additionalProperties:false を付与し、元の required を尊重する
function strictifySchema(node: Record<string, unknown>): Record<string, unknown> {
  const result = { ...node };
  for (const key of DISALLOWED_KEYWORDS) delete result[key];
  if (result.properties && typeof result.properties === "object") {
    const props = result.properties as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      out[k] = strictifySchema(v as Record<string, unknown>);
    }
    result.properties = out;
    // additionalProperties:false のとき OpenAI strict モードは required に全キーを要求する
    result.required = Object.keys(out);
    result.additionalProperties = false;
  }
  // additionalProperties がスキーマオブジェクト（辞書/マップ型）の場合は空オブジェクトに変換する
  if (!result.properties && result.additionalProperties && typeof result.additionalProperties === "object") {
    result.properties = {};
    result.required = [];
    result.additionalProperties = false;
  }
  if (result.items && typeof result.items === "object" && !Array.isArray(result.items)) {
    result.items = strictifySchema(result.items as Record<string, unknown>);
  }
  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map(strictifySchema);
    }
  }
  return result;
}

export function toChatCompletionsTools(tools: AnthropicTool[] | undefined): ToolSet | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: ToolSet = {};
  for (const t of tools) {
    const raw = (t.input_schema ?? { type: "object", properties: {}, required: [] }) as Record<string, unknown> & { $schema?: unknown };
    const { $schema, ...schema } = raw;
    void $schema;
    out[sanitizeToolName(t.name)] = {
      description: t.description,
      parameters: jsonSchema(strictifySchema(schema) as Parameters<typeof jsonSchema>[0]),
    };
  }
  return out;
}
