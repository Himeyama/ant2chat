#!/usr/bin/env pwsh
# /v1/messages エンドポイントのテストスクリプト (Anthropic Messages API 互換)
# 使い方: .\claude-test.ps1 [-BaseUrl http://localhost:3000] [-Model gpt-4o-mini]

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Model = "gpt-4o-mini"
)

$Url = "$BaseUrl/v1/messages"
$PassCount = 0
$FailCount = 0

function Test-Case {
    param([string]$Name, [scriptblock]$Body)
    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    try {
        & $Body
    } catch {
        Write-Host "FAIL: 例外発生 - $_" -ForegroundColor Red
        $script:FailCount++
    }
}

function Assert-Equal {
    param($Actual, $Expected, [string]$Label)
    if ($Actual -eq $Expected) {
        Write-Host "  PASS: $Label = $Actual" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  FAIL: $Label - 期待値: $Expected, 実際: $Actual" -ForegroundColor Red
        $script:FailCount++
    }
}

function Assert-NotNull {
    param($Value, [string]$Label)
    if ($null -ne $Value -and $Value -ne "") {
        Write-Host "  PASS: $Label は非 null" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  FAIL: $Label が null または空" -ForegroundColor Red
        $script:FailCount++
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Label)
    if ($Condition) {
        Write-Host "  PASS: $Label" -ForegroundColor Green
        $script:PassCount++
    } else {
        Write-Host "  FAIL: $Label" -ForegroundColor Red
        $script:FailCount++
    }
}

function Invoke-JsonPost {
    param([hashtable]$Body)
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    $response = Invoke-WebRequest -Uri $Url -Method Post `
        -ContentType "application/json" `
        -Headers @{ "x-api-key" = "sk-ant-dummy" } `
        -Body $json `
        -ErrorAction Stop
    return $response.Content | ConvertFrom-Json
}

# ヘルスチェック
Test-Case "ヘルスチェック" {
    $res = Invoke-RestMethod -Uri "$BaseUrl/" -Method Get -ErrorAction Stop
    Assert-Equal $res.status "ok" "status"
}

# 1. 基本的な非ストリームリクエスト
Test-Case "基本レスポンス - 非ストリーム" {
    $body = @{
        model    = $Model
        messages = @(@{ role = "user"; content = "Reply with exactly the word 'pong'." })
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-Equal $res.role "assistant" "role"
    Assert-True ($res.id -like "msg_*") "id が msg_ で始まる"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
    Assert-Equal $res.content[0].type "text" "content[0].type"
    Assert-NotNull $res.content[0].text "content[0].text"
    Assert-Equal $res.stop_reason "end_turn" "stop_reason"
    Assert-True ($res.usage.input_tokens -gt 0) "input_tokens > 0"
    Assert-True ($res.usage.output_tokens -gt 0) "output_tokens > 0"
}

# 2. system フィールド (文字列)
Test-Case "system フィールド - 文字列" {
    $body = @{
        model    = $Model
        system   = "You are a robot. Always respond with 'BEEP BOOP'."
        messages = @(@{ role = "user"; content = "Hello!" })
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
    Assert-NotNull $res.content[0].text "text が非 null"
}

# 3. system フィールド (配列 / SystemBlock)
Test-Case "system フィールド - 配列形式" {
    $body = @{
        model    = $Model
        system   = @(
            @{ type = "text"; text = "You are a helpful assistant." }
        )
        messages = @(@{ role = "user"; content = "What is 1+1?" })
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
}

# 4. マルチターン会話
Test-Case "マルチターン会話" {
    $body = @{
        model    = $Model
        messages = @(
            @{ role = "user"; content = "My favorite color is blue." }
            @{ role = "assistant"; content = "Got it! I'll remember that your favorite color is blue." }
            @{ role = "user"; content = "What is my favorite color?" }
        )
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-Equal $res.stop_reason "end_turn" "stop_reason"
    Assert-NotNull $res.content[0].text "text が非 null"
}

# 5. content が配列形式 (text ブロック)
Test-Case "content が text ブロック配列" {
    $body = @{
        model    = $Model
        messages = @(
            @{
                role    = "user"
                content = @(
                    @{ type = "text"; text = "Say 'hello'." }
                )
            }
        )
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
}

# 6. max_tokens で打ち切り
Test-Case "max_tokens で打ち切り" {
    $body = @{
        model      = $Model
        messages   = @(@{ role = "user"; content = "Count from 1 to 1000, one number per line." })
        max_tokens = 50
        stream     = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.stop_reason "max_tokens" "stop_reason = max_tokens"
}

# 7. max_completion_tokens (max_tokens の別名)
Test-Case "max_completion_tokens パラメーター" {
    $body = @{
        model                  = $Model
        messages               = @(@{ role = "user"; content = "Count from 1 to 1000." })
        max_completion_tokens  = 50
        stream                 = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.stop_reason "max_tokens" "stop_reason = max_tokens"
}

# 8. stop_sequences (モデルが stop パラメーターを非サポートの場合はスキップ)
Test-Case "stop_sequences" {
    $body = @{
        model           = $Model
        messages        = @(@{ role = "user"; content = "Count from 1 upward separated by commas." })
        stop_sequences  = @("5")
        stream          = $false
    }
    try {
        $res = Invoke-JsonPost $body
        # stop_sequence または end_turn のどちらかになる (モデル依存)
        Assert-True ($res.stop_reason -eq "end_turn" -or $res.stop_reason -eq "stop_sequence") "stop_reason が有効な値"
    } catch {
        $errBody = $_ | Select-String -Pattern "stop.*not supported|Unsupported parameter.*stop"
        if ($errBody) {
            Write-Host "  SKIP: このモデルは stop_sequences 非対応" -ForegroundColor Yellow
        } else {
            throw
        }
    }
}

# 9. temperature / top_p パラメーター
Test-Case "temperature / top_p パラメーター" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "Say 'ok'." })
        temperature = 0.7
        top_p       = 0.9
        stream      = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-Equal $res.stop_reason "end_turn" "stop_reason"
}

# 10. ツール呼び出し - 非ストリーム
Test-Case "ツール呼び出し - 非ストリーム" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "What is the weather in Tokyo? Use the get_weather tool." })
        tools       = @(
            @{
                name         = "get_weather"
                description  = "Get the current weather for a city"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ city = @{ type = "string"; description = "City name" } }
                    required             = @("city")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "tool"; name = "get_weather" }
        stream      = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.stop_reason "tool_use" "stop_reason = tool_use"
    $toolUse = $res.content | Where-Object { $_.type -eq "tool_use" } | Select-Object -First 1
    Assert-NotNull $toolUse "tool_use ブロックが存在する"
    if ($toolUse) {
        Assert-Equal $toolUse.name "get_weather" "ツール名"
        Assert-NotNull $toolUse.id "id が非 null"
        Assert-NotNull $toolUse.input "input が非 null"
        Assert-NotNull $toolUse.input.city "input.city が非 null"
    }
}

# 11. tool_choice = "any"
Test-Case "tool_choice = any (任意のツールを強制)" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "What is the weather in Paris?" })
        tools       = @(
            @{
                name         = "get_weather"
                description  = "Get weather for a city"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ city = @{ type = "string" } }
                    required             = @("city")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "any" }
        stream      = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.stop_reason "tool_use" "stop_reason = tool_use"
    $toolUse = $res.content | Where-Object { $_.type -eq "tool_use" } | Select-Object -First 1
    Assert-NotNull $toolUse "tool_use ブロックが存在する"
}

# 12. tool_choice = "none" (ツールを使わない)
Test-Case "tool_choice = none" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "What is the weather in Tokyo?" })
        tools       = @(
            @{
                name         = "get_weather"
                description  = "Get weather"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ city = @{ type = "string" } }
                    required             = @("city")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "none" }
        stream      = $false
    }
    $res = Invoke-JsonPost $body
    $toolUse = $res.content | Where-Object { $_.type -eq "tool_use" }
    Assert-True ($null -eq $toolUse -or $toolUse.Count -eq 0) "tool_use が 0 件"
    $textBlock = $res.content | Where-Object { $_.type -eq "text" } | Select-Object -First 1
    Assert-NotNull $textBlock "テキストブロックが存在する"
}

# 13. 複数ツール定義
Test-Case "複数ツール定義" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "Get the weather in London." })
        tools       = @(
            @{
                name         = "get_weather"
                description  = "Get weather for a city"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ city = @{ type = "string" } }
                    required             = @("city")
                    additionalProperties = $false
                }
            }
            @{
                name         = "get_news"
                description  = "Get latest news headlines"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ topic = @{ type = "string" } }
                    required             = @("topic")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "tool"; name = "get_weather" }
        stream      = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.stop_reason "tool_use" "stop_reason = tool_use"
    $toolUse = $res.content | Where-Object { $_.type -eq "tool_use" } | Select-Object -First 1
    Assert-NotNull $toolUse "tool_use が存在する"
    if ($toolUse) {
        Assert-Equal $toolUse.name "get_weather" "指定したツールが呼ばれる"
    }
}

# 14. ツール結果フィードバック - マルチターン
Test-Case "ツール結果フィードバック - マルチターン" {
    $toolId = "toolu_abc123"
    $body = @{
        model    = $Model
        messages = @(
            @{ role = "user"; content = "What is the weather in Tokyo?" }
            @{
                role    = "assistant"
                content = @(
                    @{ type = "tool_use"; id = $toolId; name = "get_weather"; input = @{ city = "Tokyo" } }
                )
            }
            @{
                role    = "user"
                content = @(
                    @{
                        type        = "tool_result"
                        tool_use_id = $toolId
                        content     = '{"temperature":22,"condition":"Sunny"}'
                    }
                )
            }
        )
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-Equal $res.stop_reason "end_turn" "stop_reason"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
    $textBlock = $res.content | Where-Object { $_.type -eq "text" } | Select-Object -First 1
    Assert-NotNull $textBlock "テキストブロックが存在する"
}

# 15. is_error = true の tool_result
Test-Case "tool_result is_error フラグ" {
    $toolId = "toolu_err001"
    $body = @{
        model    = $Model
        messages = @(
            @{ role = "user"; content = "Look up the stock price of ACME." }
            @{
                role    = "assistant"
                content = @(
                    @{ type = "tool_use"; id = $toolId; name = "get_stock"; input = @{ ticker = "ACME" } }
                )
            }
            @{
                role    = "user"
                content = @(
                    @{
                        type        = "tool_result"
                        tool_use_id = $toolId
                        content     = "Service unavailable"
                        is_error    = $true
                    }
                )
            }
        )
        stream   = $false
    }
    $res = Invoke-JsonPost $body
    Assert-Equal $res.type "message" "type"
    Assert-True ($res.content.Count -gt 0) "content が空でない"
}

# 16. ストリーミング - SSE イベント確認
Test-Case "ストリーミング - SSE イベント確認" {
    $body = @{
        model    = $Model
        messages = @(@{ role = "user"; content = "Say 'hello' only." })
        stream   = $true
    }
    $json = $body | ConvertTo-Json -Depth 10 -Compress

    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = "POST"
    $req.ContentType = "application/json"
    $req.Headers.Add("x-api-key", "sk-ant-dummy")
    $req.Timeout = 30000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $req.ContentLength = $bytes.Length
    $reqStream = $req.GetRequestStream()
    $reqStream.Write($bytes, 0, $bytes.Length)
    $reqStream.Close()

    $res = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($res.GetResponseStream())

    $events = @()
    $line = $reader.ReadLine()
    while ($null -ne $line) {
        if ($line -like "event: *") {
            $events += $line.Substring(7)
        }
        $line = $reader.ReadLine()
    }
    $reader.Close()
    $res.Close()

    Assert-True ($events -contains "message_start") "message_start イベントあり"
    Assert-True ($events -contains "ping") "ping イベントあり"
    Assert-True ($events -contains "content_block_start") "content_block_start イベントあり"
    Assert-True ($events -contains "content_block_delta") "content_block_delta イベントあり"
    Assert-True ($events -contains "content_block_stop") "content_block_stop イベントあり"
    Assert-True ($events -contains "message_delta") "message_delta イベントあり"
    Assert-True ($events -contains "message_stop") "message_stop イベントあり"
    # イベント順序: message_start が最初
    Assert-Equal $events[0] "message_start" "先頭イベントが message_start"
}

# 17. ストリーミング - ツール呼び出し SSE イベント
Test-Case "ストリーミング - ツール呼び出し SSE" {
    $body = @{
        model       = $Model
        messages    = @(@{ role = "user"; content = "Get weather in Berlin." })
        tools       = @(
            @{
                name         = "get_weather"
                description  = "Get weather for a city"
                input_schema = @{
                    type                 = "object"
                    properties           = @{ city = @{ type = "string" } }
                    required             = @("city")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "tool"; name = "get_weather" }
        stream      = $true
    }
    $json = $body | ConvertTo-Json -Depth 10 -Compress

    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = "POST"
    $req.ContentType = "application/json"
    $req.Headers.Add("x-api-key", "sk-ant-dummy")
    $req.Timeout = 30000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $req.ContentLength = $bytes.Length
    $reqStream = $req.GetRequestStream()
    $reqStream.Write($bytes, 0, $bytes.Length)
    $reqStream.Close()

    $res = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($res.GetResponseStream())

    $events = @()
    $blockStartData = @()
    $line = $reader.ReadLine()
    $lastEvent = ""
    while ($null -ne $line) {
        if ($line -like "event: *") {
            $lastEvent = $line.Substring(7)
            $events += $lastEvent
        } elseif ($line -like "data: *" -and $lastEvent -eq "content_block_start") {
            $blockStartData += ($line.Substring(6) | ConvertFrom-Json)
        }
        $line = $reader.ReadLine()
    }
    $reader.Close()
    $res.Close()

    Assert-True ($events -contains "content_block_start") "content_block_start イベントあり"
    Assert-True ($events -contains "message_stop") "message_stop イベントあり"
    $toolBlock = $blockStartData | Where-Object { $_.content_block.type -eq "tool_use" } | Select-Object -First 1
    Assert-NotNull $toolBlock "tool_use ブロックの content_block_start あり"
    if ($toolBlock) {
        Assert-Equal $toolBlock.content_block.name "get_weather" "ツール名"
    }
}

# 18. 不正 JSON - 400 エラー
Test-Case "不正 JSON - 400 エラー" {
    try {
        Invoke-WebRequest -Uri $Url -Method Post `
            -ContentType "application/json" `
            -Headers @{ "x-api-key" = "sk-ant-dummy" } `
            -Body "not json" `
            -ErrorAction Stop | Out-Null
        Write-Host "  FAIL: 400 が返るべきだが成功した" -ForegroundColor Red
        $script:FailCount++
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Assert-Equal $code 400 "HTTP ステータスコード"
    }
}

# 結果サマリー
Write-Host "`n==============================" -ForegroundColor Yellow
Write-Host "結果: PASS $PassCount / $(($PassCount + $FailCount)) テスト" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Yellow" })
if ($FailCount -gt 0) {
    Write-Host "FAIL: $FailCount 件" -ForegroundColor Red
    exit 1
} else {
    Write-Host "すべてのテストが通過しました" -ForegroundColor Green
    exit 0
}
