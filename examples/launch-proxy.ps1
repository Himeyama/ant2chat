# ant2chat 起動スクリプト
# -Provider openai (デフォルト) または -Provider ollama で切り替え
param(
    [ValidateSet("openai", "ollama")]
    [string]$Provider = "openai"
)

pnpm build

switch ($Provider) {
    "openai" {
        $url    = "https://api.openai.com/v1"
        $apiKey = $env:OPENAI_API_KEY
        $auth   = "bearer"
        $model  = "gpt-5.4-mini" 
    }
    "ollama" {
        $url    = "http://localhost:11434/v1"
        $apiKey = "sk-dummy"
        $auth   = "bearer"
        $model  = "gemma4:e4b"
    }
}

Write-Host "Provider: $Provider  →  $url"
node --env-file=.env dist/index.js --port 3000 --api-key $apiKey --auth-type $auth --provider $Provider --model $model
