#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { createApp } from "./server.js";

const { port, baseURL, authType } = config;
const app = createApp();

serve({ fetch: app.fetch, port }, () => {
  console.log(`Anthropic → Chat Completions proxy listening on http://localhost:${port}`);
  console.log(`  Upstream:  ${baseURL}`);
  console.log(`  Auth type: ${authType}`);
});
