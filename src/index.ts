#!/usr/bin/env node
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { createApp } from "./server.js";
import { handleResponsesWs } from "./handlers/responses-ws.js";
import { tuiLog } from "./tui-log.js";

const { port, baseURL, authType, defaultModel, providerName, geminiRelayURL, geminiCache, geminiCacheTtl, global: globalListen } = config;
const hostname = globalListen ? "0.0.0.0" : "127.0.0.1";
const app = createApp();

const server = serve({ fetch: app.fetch, port, hostname }, () => {
  const apiLabel =
    providerName === "responses" ? "Responses API" :
    providerName === "google" || providerName === "gemini" ? "Gemini API" :
    providerName === "azure" ? "Azure OpenAI" :
    providerName === "custom" ? "Custom (OpenAI-compatible)" :
    "Chat Completions";
  const displayHost = globalListen ? "0.0.0.0" : "localhost";
  const bannerLines: string[] = [];
  bannerLines.push(`→ ${apiLabel} proxy listening on http://${displayHost}:${port}`);
  bannerLines.push(`  Provider:  ${providerName}`);
  if (geminiRelayURL) {
    bannerLines.push(`  Upstream:  ${geminiRelayURL} (relay)`);
  } else if (baseURL) {
    bannerLines.push(`  Upstream:  ${baseURL}`);
  }
  bannerLines.push(`  Auth type: ${authType}`);
  if (defaultModel) {
    bannerLines.push(`  Model:     ${defaultModel} (forced)`);
  } else {
    bannerLines.push(`  Model:     (client-specified)`);
  }
  if (geminiCache && (providerName === "google" || providerName === "gemini")) {
    const via = geminiRelayURL ? ", generate via relay" : "";
    bannerLines.push(`  Cache:     explicit (CachedContent, ttl ${geminiCacheTtl}s${via})`);
  }
  for (const line of bannerLines) console.log(line);
  tuiLog.setBanner(bannerLines);
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname === "/v1/responses") {
    wss.handleUpgrade(req, socket, head, (ws) => {
      const auth = (req.headers["authorization"] as string | undefined) ?? "";
      const apiKey = auth.replace(/^Bearer\s+/i, "") || ((req.headers["x-api-key"] as string) ?? "");
      handleResponsesWs(ws, apiKey, req.headers).catch(console.error);
    });
  } else {
    socket.destroy();
  }
});
