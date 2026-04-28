$appKey = "502296"
$appSecret = "vwTUfjBmG7MLdyjsZnOC9pfJsy9hGo1V"
$redirectUri = "https://example.com/callback"
$code = $args[0]

if (-not $code) {
    Write-Host "Usage: .\support_test.ps1 <AUTH_CODE>"
    Write-Host "Get a fresh code from:"
    Write-Host "https://openapi-auth.alibaba.com/oauth/authorize?response_type=code&client_id=502296&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback"
    exit
}

function Get-IopSign($params, $apiName, $secret) {
    $sorted = $params.GetEnumerator() | Sort-Object Name
    $str = $apiName
    foreach ($kv in $sorted) {
        if ($null -ne $kv.Value -and $kv.Value -ne "") {
            $str += $kv.Name + $kv.Value
        }
    }
    $key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $msg = [System.Text.Encoding]::UTF8.GetBytes($str)
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = $key
    $hash = $hmac.ComputeHash($msg)
    return ($hash | ForEach-Object { $_.ToString("X2") }) -join ""
}

function Test-Endpoint($label, $url, $params, $isJson = $false) {
    Write-Host "`n--- $label ---"
    Write-Host "URL: $url"
    
    $body = ""
    if ($params -is [hashtable] -or $params -is [PSOrderedHashtable]) {
        $body = ($params.GetEnumerator() | ForEach-Object {
            [uri]::EscapeDataString($_.Name) + "=" + [uri]::EscapeDataString($_.Value)
        }) -join "&"
    } else {
        $body = $params
    }

    try {
        $contentType = "application/x-www-form-urlencoded"
        $r = Invoke-WebRequest -Uri $url -Method Post -Body $body -ContentType $contentType -TimeoutSec 15
        Write-Host "Status: $($r.StatusCode)"
        Write-Host "Response: $($r.Content)"
    } catch {
        Write-Host "Error: $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host "Body: $($reader.ReadToEnd())"
        }
    }
}

$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()

Write-Host "============================================================"
Write-Host "ALIBABA TOKEN EXCHANGE SUPPORT TEST (PowerShell Version)"
Write-Host "============================================================"
Write-Host "Time:         $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "App Key:      $appKey"
Write-Host "Auth Code:    $code"
Write-Host "============================================================"

# Test 1: IOP Signed Request to api.taobao.global
$params1 = @{
    app_key     = $appKey
    code        = $code
    sign_method = "sha256"
    timestamp   = $ts
}
$params1["sign"] = Get-IopSign $params1 "/auth/token/create" $appSecret
Test-Endpoint "TEST 1: api.taobao.global (Signed)" "https://api.taobao.global/rest/auth/token/create" $params1

# Test 2: Standard OAuth to oauth.alibaba.com
$params2 = @{
    grant_type    = "authorization_code"
    code          = $code
    client_id     = $appKey
    client_secret = $appSecret
    redirect_uri  = $redirectUri
}
Test-Endpoint "TEST 2: oauth.alibaba.com (Standard OAuth2)" "https://oauth.alibaba.com/token" $params2

# Test 3: GGS Gateway
Test-Endpoint "TEST 3: gw.api.alibaba.com (GGS Gateway)" "https://gw.api.alibaba.com/openapi/param2/1/auth.token.create/$appKey" $params2

Write-Host "`n============================================================"
Write-Host "TEST COMPLETE - PLEASE SCREENSHOT THIS OUTPUT FOR SUPPORT"
Write-Host "============================================================"
