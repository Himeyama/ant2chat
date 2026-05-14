#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { createApp } from "./server.js";

// .env を読み込む (Node 20.6+ のネイティブサポートを使用)
// tsx 実行時は tsx が自動で .env を読む場合もあるが、明示的に指定する場合は
// `node --env-file=.env` または dotenv を使うこと

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

serve({ fetch: app.fetch, port }, () => {
  console.log(`Anthropic → Chat Completions proxy listening on http://localhost:${port}`);
  console.log(`  Upstream: ${process.env.CHAT_BASE_URL ?? "http://localhost:11434/v1"}`);
});
