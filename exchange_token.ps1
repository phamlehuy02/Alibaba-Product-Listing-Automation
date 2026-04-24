try {
    $body = @{
        grant_type = "authorization_code"
        code = "3_502296_Q8vX8xN6ihrC16y0J2VzPU6B34"
        client_id = "502296"
        client_secret = "vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V"
        redirect_uri = "https://example.com/callback"
    }
    $result = Invoke-WebRequest -Uri "https://api.alibaba.com/auth/token/create" -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"
    [System.Text.Encoding]::UTF8.GetString($result.Content)
} catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        $reader.ReadToEnd()
    } else {
        $_.Exception.Message
    }
}
