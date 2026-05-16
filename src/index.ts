#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { createApp } from "./server.js";

const { port, baseURL, authType, defaultModel, providerName } = config;
const app = createApp();

serve({ fetch: app.fetch, port }, () => {
  const apiLabel =
    providerName === "responses" ? "Responses API" :
    providerName === "google" || providerName === "gemini" ? "Gemini API" :
    "Chat Completions";
  console.log(`Anthropic → ${apiLabel} proxy listening on http://localhost:${port}`);
  console.log(`  Provider:  ${providerName}`);
  if (baseURL) console.log(`  Upstream:  ${baseURL}`);
  console.log(`  Auth type: ${authType}`);
  if (defaultModel) console.log(`  Model:     ${defaultModel} (forced)`);
});
