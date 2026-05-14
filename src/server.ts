import { Hono } from "hono";
import { handleMessages } from "./handlers/messages.js";

export function createApp() {
  const app = new Hono();

  // ヘルスチェック
  app.get("/", (c) => c.json({ status: "ok" }));

  // Anthropic Messages API エンドポイント
  app.post("/v1/messages", handleMessages);

  // 未定義ルート
  app.notFound((c) => c.json({ type: "error", error: { type: "not_found_error", message: "Not found" } }, 404));

  return app;
}
