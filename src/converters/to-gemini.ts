import { jsonSchema, type ToolSet } from "ai";
import type { AnthropicTool } from "../types/anthropic.js";
import { sanitizeToolName } from "./shared.js";

// Gemini が非対応の JSON Schema キーワード
const DISALLOWED_KEYWORDS = new Set([
  "$schema", "propertyNames", "if", "then", "else", "not", "contains",
  "patternProperties", "format", "additionalProperties", "default", "examples",
]);

// required を properties に存在するキーのみに絞り、非対応キーワードを除去する
function sanitizeSchema(node: Record<string, unknown>): Record<string, unknown> {
  const result = { ...node };
  for (const key of DISALLOWED_KEYWORDS) delete result[key];
  if (result.properties && typeof result.properties === "object") {
    const props = result.properties as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      out[k] = sanitizeSchema(v as Record<string, unknown>);
    }
    result.properties = out;
    if (Array.isArray(result.required)) {
      const defined = new Set(Object.keys(out));
      result.required = (result.required as string[]).filter((k) => defined.has(k));
      if ((result.required as string[]).length === 0) delete result.required;
    }
  } else if (Array.isArray(result.required)) {
    // properties がない場合は required は常に無効
    delete result.required;
  }
  if (result.items && typeof result.items === "object" && !Array.isArray(result.items)) {
    result.items = sanitizeSchema(result.items as Record<string, unknown>);
  }
  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Record<string, unknown>[]).map(sanitizeSchema);
    }
  }
  return result;
}

export function toGeminiTools(tools: AnthropicTool[] | undefined): ToolSet | undefined {
  if (!tools || tools.length === 0) return undefined;
  const out: ToolSet = {};
  for (const t of tools) {
    const raw = (t.input_schema ?? { type: "object", properties: {} }) as Record<string, unknown> & { $schema?: unknown };
    const { $schema, ...schema } = raw;
    void $schema;
    out[sanitizeToolName(t.name)] = {
      description: t.description,
      parameters: jsonSchema(sanitizeSchema(schema) as Parameters<typeof jsonSchema>[0]),
    };
  }
  return out;
}
