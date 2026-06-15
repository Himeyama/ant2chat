import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";
import { config } from "../config.js";

export function isGoogleProvider(providerName: string): boolean {
  return providerName === "google" || providerName === "gemini";
}

export function isResponsesProvider(providerName: string): boolean {
  return providerName === "responses";
}

export function getProvider(apiKey: string) {
  const { baseURL, customBaseURL, authType, providerName } = config;
  if (isGoogleProvider(providerName)) {
    return createGoogleGenerativeAI({ apiKey, ...(customBaseURL ? { baseURL: customBaseURL } : {}) });
  }
  if (authType === "api-key") {
    return createOpenAI({
      apiKey: "no-key",
      baseURL,
      headers: { "api-key": apiKey },
      compatibility: "compatible",
    });
  }
  return createOpenAI({ apiKey, baseURL, compatibility: "compatible" });
}

export function resolveModel(requestedModel: string): string {
  return config.defaultModel || requestedModel;
}

export function getLanguageModel(provider: ReturnType<typeof getProvider>, model: string): LanguageModelV1 {
  return (
    isResponsesProvider(config.providerName)
      ? (provider as ReturnType<typeof createOpenAI>).responses(model)
      : provider(model)
  ) as LanguageModelV1;
}

export function stripEmptyStringValues(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return (args ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (value !== "") result[key] = value;
  }
  return result;
}

export function extractUpstreamError(err: unknown): { type: string; message: string; statusCode: number } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const statusCode = typeof e.statusCode === "number" ? e.statusCode : 502;
    const data = e.data as Record<string, unknown> | undefined;
    const upstreamError = data?.error as Record<string, unknown> | undefined;
    if (upstreamError) {
      return {
        type: typeof upstreamError.type === "string" ? upstreamError.type : "api_error",
        message: typeof upstreamError.message === "string" ? upstreamError.message : String(err),
        statusCode,
      };
    }
    const message = typeof e.message === "string" ? e.message : "Upstream error";
    return { type: "api_error", message, statusCode };
  }
  return { type: "api_error", message: "Upstream error", statusCode: 502 };
}

export function makeId(prefix: string): string {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "")}`;
}

// AI SDK の providerMetadata からキャッシュトークン数を抽出する。
// OpenAI 系: providerMetadata.openai.cachedPromptTokens (prompt/input_tokens_details.cached_tokens 由来)。
// 上流がキャッシュ情報を報告しない場合 (Gemini など) は 0。出力キャッシュを報告する上流は現状ないため 0。
export function extractCacheTokens(providerMetadata: unknown): {
  inputCacheTokens: number;
  outputCacheTokens: number;
} {
  const meta = providerMetadata as Record<string, Record<string, unknown> | undefined> | undefined;
  const openai = meta?.openai;
  const cached = openai?.cachedPromptTokens;
  return {
    inputCacheTokens: typeof cached === "number" ? cached : 0,
    outputCacheTokens: 0,
  };
}
