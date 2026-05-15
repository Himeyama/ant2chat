param(
    [string]$Model = "gemma4:e4b"
)

$env:ANTHROPIC_BASE_URL = "http://localhost:3000"
$env:ANTHROPIC_API_KEY = "sk-ant-dummy"

claude --model $Model
