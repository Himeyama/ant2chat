# ant コマンド 実行例
# ant = Anthropic → Chat Completions プロキシサーバー

# ────────────────────────────────────────────
# インストール
# ────────────────────────────────────────────

# ビルド
pnpm build

# グローバルにリンク (初回のみ)
# pnpm link --global

# ────────────────────────────────────────────
# 起動
# ────────────────────────────────────────────

# デフォルト設定で起動 (Ollama など localhost:11434 に接続)
# ant

# 環境変数を指定して起動
$env:CHAT_API_KEY  = "sk-..."
$env:CHAT_BASE_URL = "http://localhost:11434/v1"
$env:PORT          = "3000"
# ant

# .env ファイルを使って起動 (Node 20.6+)
node --env-file=.env dist/index.js
