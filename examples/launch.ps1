# ant2chat 起動サンプル

pnpm build

# CLI 引数で指定 (環境変数より優先)
#   -u / --url       接続先 URL
#   -p / --port      リスンポート
#   -k / --api-key   APIキー
#   --auth-type      認証形式: bearer (デフォルト) | api-key

# .env ファイルで起動しつつ CLI 引数で上書き (Node 20.6+)
node --env-file=.env dist/index.js --url http://localhost:11434/v1 --port 3000 --api-key sk-dummy --auth-type bearer
