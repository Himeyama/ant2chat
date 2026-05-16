import { parseArgs } from "node:util";

const PROVIDER_URLS: Record<string, string> = {
  ollama: "http://localhost:11434/v1",
  openai: "https://api.openai.com/v1",
  google: "",
};

const { values } = parseArgs({
  options: {
    url:         { type: "string",  short: "u" },
    provider:    { type: "string" },
    port:        { type: "string",  short: "p" },
    "api-key":   { type: "string",  short: "k" },
    "auth-type": { type: "string" },
    model:       { type: "string",  short: "m" },
    help:        { type: "boolean", short: "h" },
  },
  strict: false,
});

if (values.help) {
  console.log(`\
ant2chat — Anthropic Messages API → OpenAI Chat Completions proxy

Usage:
  ant2chat [options]

Options:
      --provider <name>   Upstream provider: ollama | openai | google (default: ollama)
  -u, --url <url>         Upstream base URL (overrides --provider)
  -p, --port <port>       Listen port (default: 3000)
  -k, --api-key <key>     Upstream API key
      --auth-type <type>  Auth header type: bearer | api-key (default: bearer)
  -m, --model <model>     Force model name (overrides client's model field)
  -h, --help              Show this help

Environment variables (overridden by CLI options):
  CHAT_BASE_URL                  Upstream base URL
  PORT                           Listen port
  CHAT_API_KEY                   Upstream API key
  OPENAI_API_KEY                 API key fallback when --provider openai is used
  GOOGLE_GENERATIVE_AI_API_KEY   API key fallback when --provider google is used
  CHAT_AUTH_TYPE                 Auth header type
  CHAT_DEFAULT_MODEL             Default model name
`);
  process.exit(0);
}

function resolveProvider(): string {
  return String(values.provider ?? "ollama");
}

function resolveBaseURL(provider: string): string {
  if (values.url && values.provider) {
    console.warn(`\x1b[33mWarning: --url and --provider are both specified. --url takes precedence.\x1b[0m`);
  }
  if (values.url) return String(values.url);
  if (process.env.CHAT_BASE_URL) return process.env.CHAT_BASE_URL;
  if (!(provider in PROVIDER_URLS)) {
    console.error(`Unknown provider: "${provider}". Available: ${Object.keys(PROVIDER_URLS).join(", ")}`);
    process.exit(1);
  }
  return PROVIDER_URLS[provider];
}

export type AuthType = "bearer" | "api-key";

function resolveApiKey(provider: string): string {
  if (values["api-key"] != null) return String(values["api-key"]);
  if (process.env.CHAT_API_KEY) return process.env.CHAT_API_KEY;
  if (provider === "openai" && process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  if (provider === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (provider !== "ollama") {
    console.warn(`\x1b[33mWarning: No API key specified. Set --api-key, CHAT_API_KEY, or (for --provider openai) OPENAI_API_KEY, (for --provider google) GOOGLE_GENERATIVE_AI_API_KEY.\x1b[0m`);
  }
  return "";
}

const providerName = resolveProvider();

export const config = {
  providerName,
  baseURL:      resolveBaseURL(providerName),
  port:         Number(values.port        ?? process.env.PORT               ?? 3000),
  apiKey:       resolveApiKey(providerName),
  authType:     String(values["auth-type"] ?? process.env.CHAT_AUTH_TYPE    ?? "bearer") as AuthType,
  defaultModel: values.model != null ? String(values.model) : (process.env.CHAT_DEFAULT_MODEL ?? ""),
};
