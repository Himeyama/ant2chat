#!/usr/bin/env pwsh
# /v1/responses エンドポイントのテストスクリプト
# 使い方: .\responses-test.ps1 [-BaseUrl http://localhost:3000]

param(
    [string]$BaseUrl = "http://localhost:3000"
)

$Url = "$BaseUrl/v1/responses"
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

function Post-Json {
    param([hashtable]$Body)
    $json = $Body | ConvertTo-Json -Depth 10 -Compress
    $response = Invoke-WebRequest -Uri $Url -Method Post `
        -ContentType "application/json" `
        -Body $json `
        -ErrorAction Stop
    return $response.Content | ConvertFrom-Json
}

# ヘルスチェック
Test-Case "ヘルスチェック" {
    $res = Invoke-RestMethod -Uri "$BaseUrl/" -Method Get -ErrorAction Stop
    Assert-Equal $res.status "ok" "status"
}

# 1. 文字列 input (非ストリーム)
Test-Case "文字列 input - 非ストリーム" {
    $body = @{
        model = "gpt-4o-mini"
        input = "Hello, reply with just 'Hi'."
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-True ($res.id -like "resp_*") "id が resp_ で始まる"
    Assert-True ($res.created_at -gt 0) "created_at が正の数"
    Assert-True ($res.output.Count -gt 0) "output が空でない"
    Assert-Equal $res.output[0].type "message" "output[0].type"
    Assert-Equal $res.output[0].role "assistant" "output[0].role"
    Assert-Equal $res.output[0].status "completed" "output[0].status"
    Assert-True ($res.output[0].content.Count -gt 0) "content が空でない"
    Assert-Equal $res.output[0].content[0].type "output_text" "content[0].type"
    Assert-NotNull $res.output[0].content[0].text "content[0].text"
    Assert-Equal $res.status "completed" "status"
    Assert-True ($res.usage.input_tokens -gt 0) "input_tokens > 0"
    Assert-True ($res.usage.output_tokens -gt 0) "output_tokens > 0"
    Assert-Equal $res.error $null "error は null"
}

# 2. 配列 input (通常メッセージ)
Test-Case "配列 input - user/assistant 交互" {
    $body = @{
        model = "gpt-4o-mini"
        input = @(
            @{ role = "user"; content = "What is 2+2?" }
            @{ role = "assistant"; content = "4" }
            @{ role = "user"; content = "And 3+3?" }
        )
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-True ($res.output.Count -gt 0) "output が空でない"
    Assert-Equal $res.output[-1].type "message" "最後の output が message"
}

# 3. instructions フィールド
Test-Case "instructions フィールド" {
    $body = @{
        model = "gpt-4o-mini"
        input = "What is your job?"
        instructions = "You are a helpful pirate. Always end sentences with 'Arrr!'."
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-True ($res.output.Count -gt 0) "output が空でない"
    Assert-NotNull $res.output[0].content[0].text "text が非 null"
}

# 4. ツール呼び出し (非ストリーム)
Test-Case "ツール呼び出し - 非ストリーム" {
    $body = @{
        model = "gpt-4o-mini"
        input = "What is the weather in Tokyo? Use the get_weather tool."
        tools = @(
            @{
                type = "function"
                name = "get_weather"
                description = "Get the current weather for a city"
                parameters = @{
                    type = "object"
                    properties = @{
                        city = @{ type = "string"; description = "City name" }
                    }
                    required = @("city")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = "required"
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    $toolCall = $res.output | Where-Object { $_.type -eq "function_call" } | Select-Object -First 1
    Assert-NotNull $toolCall "function_call が存在する"
    if ($toolCall) {
        Assert-Equal $toolCall.name "get_weather" "ツール名"
        Assert-True ($toolCall.id -like "fc_*") "id が fc_ で始まる"
        Assert-NotNull $toolCall.call_id "call_id が非 null"
        Assert-Equal $toolCall.status "completed" "status"
        $args = $toolCall.arguments | ConvertFrom-Json
        Assert-NotNull $args.city "arguments.city"
    }
}

# 5. ツール呼び出し → 結果フィードバック (マルチターン)
Test-Case "ツール結果フィードバック - マルチターン" {
    $callId = "call_abc123"
    $body = @{
        model = "gpt-4o-mini"
        input = @(
            @{ role = "user"; content = "What is the weather in Tokyo?" }
            @{
                type = "function_call"
                id = "fc_001"
                call_id = $callId
                name = "get_weather"
                arguments = '{"city":"Tokyo"}'
            }
            @{
                type = "function_call_output"
                call_id = $callId
                output = '{"temperature":22,"condition":"Sunny"}'
            }
        )
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-True ($res.output.Count -gt 0) "output が空でない"
    $textItem = $res.output | Where-Object { $_.type -eq "message" } | Select-Object -First 1
    Assert-NotNull $textItem "message output が存在する"
}

# 6. max_output_tokens で打ち切り
Test-Case "max_output_tokens で incomplete" {
    $body = @{
        model = "gpt-4o-mini"
        input = "Count from 1 to 1000, one number per line."
        max_output_tokens = 10
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.status "incomplete" "status = incomplete"
    Assert-NotNull $res.incomplete_details "incomplete_details が非 null"
    Assert-Equal $res.incomplete_details.reason "max_tokens" "incomplete_details.reason"
}

# 7. tool_choice = "none"
Test-Case "tool_choice = none (ツールを使わない)" {
    $body = @{
        model = "gpt-4o-mini"
        input = "What is the weather in Tokyo?"
        tools = @(
            @{
                type = "function"
                name = "get_weather"
                description = "Get weather"
                parameters = @{ type = "object"; properties = @{}; required = @(); additionalProperties = $false }
            }
        )
        tool_choice = "none"
        stream = $false
    }
    $res = Post-Json $body
    $toolCalls = $res.output | Where-Object { $_.type -eq "function_call" }
    Assert-True ($toolCalls.Count -eq 0) "ツール呼び出しが 0 件"
    $textItems = $res.output | Where-Object { $_.type -eq "message" }
    Assert-True ($textItems.Count -gt 0) "テキスト出力が存在する"
}

# 8. 複数ツール定義
Test-Case "複数ツール定義" {
    $body = @{
        model = "gpt-4o-mini"
        input = "Get the weather in London."
        tools = @(
            @{
                type = "function"
                name = "get_weather"
                description = "Get weather for a city"
                parameters = @{
                    type = "object"
                    properties = @{ city = @{ type = "string" } }
                    required = @("city")
                    additionalProperties = $false
                }
            }
            @{
                type = "function"
                name = "get_news"
                description = "Get latest news headlines"
                parameters = @{
                    type = "object"
                    properties = @{ topic = @{ type = "string" } }
                    required = @("topic")
                    additionalProperties = $false
                }
            }
        )
        tool_choice = @{ type = "function"; name = "get_weather" }
        stream = $false
    }
    $res = Post-Json $body
    $toolCall = $res.output | Where-Object { $_.type -eq "function_call" } | Select-Object -First 1
    Assert-NotNull $toolCall "function_call が存在する"
    if ($toolCall) {
        Assert-Equal $toolCall.name "get_weather" "指定したツールが呼ばれる"
    }
}

# 9. input_text パーツ配列
Test-Case "content が input_text 配列" {
    $body = @{
        model = "gpt-4o-mini"
        input = @(
            @{
                role = "user"
                content = @(
                    @{ type = "input_text"; text = "Say hello." }
                )
            }
        )
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-True ($res.output.Count -gt 0) "output が空でない"
}

# 10. ストリーミングレスポンスの基本確認
Test-Case "ストリーミング - SSE イベント確認" {
    $body = @{
        model = "gpt-4o-mini"
        input = "Say 'hello' only."
        stream = $true
    }
    $json = $body | ConvertTo-Json -Depth 10 -Compress

    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = "POST"
    $req.ContentType = "application/json"
    $req.Timeout = 30000
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()

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

    Assert-True ($events -contains "response.created") "response.created イベントあり"
    Assert-True ($events -contains "response.output_item.added") "response.output_item.added イベントあり"
    Assert-True ($events -contains "response.content_part.added") "response.content_part.added イベントあり"
    Assert-True ($events -contains "response.output_text.delta") "response.output_text.delta イベントあり"
    Assert-True ($events -contains "response.output_text.done") "response.output_text.done イベントあり"
    Assert-True ($events -contains "response.content_part.done") "response.content_part.done イベントあり"
    Assert-True ($events -contains "response.output_item.done") "response.output_item.done イベントあり"
    Assert-True ($events -contains "response.completed") "response.completed イベントあり"
}

# 11. 不正 JSON でエラーが返る
Test-Case "不正 JSON - 400 エラー" {
    try {
        Invoke-WebRequest -Uri $Url -Method Post `
            -ContentType "application/json" `
            -Body "not json" `
            -ErrorAction Stop | Out-Null
        Write-Host "  FAIL: 400 が返るべきだが成功した" -ForegroundColor Red
        $script:FailCount++
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Assert-Equal $code 400 "HTTP ステータスコード"
    }
}

# 12. temperature / top_p パラメーター (異常なく完了するか確認)
Test-Case "temperature / top_p パラメーター" {
    $body = @{
        model = "gpt-4o-mini"
        input = "Say 'ok'."
        temperature = 0.5
        top_p = 0.9
        stream = $false
    }
    $res = Post-Json $body
    Assert-Equal $res.object "response" "object"
    Assert-Equal $res.status "completed" "status"
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
