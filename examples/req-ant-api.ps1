$body = @{
    model = "gemma4:e4b"
    max_tokens = 256
    messages = @(
        @{
            role = "user"
            content = "hi"
        }
    )
} | ConvertTo-Json -Depth 10

$response = Invoke-RestMethod `
    -Uri "http://localhost:3000/v1/messages?beta=true" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "x-api-key" = "dummy"
        "anthropic-version" = "2023-06-01"
    } `
    -Body $body

$response
