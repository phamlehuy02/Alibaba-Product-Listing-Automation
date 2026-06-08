# One-time setup: start the dashboard automatically when you log in to Windows.
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$DevScript = Join-Path $ScriptDir "dev-server.ps1"
$TaskName = "AlibabaListingBotDev"
$LogDir = Join-Path $ProjectDir "logs"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "❌ Không tìm thấy Node.js."
    Write-Host "   → Cài Node.js từ https://nodejs.org/ (xem README — mục Yêu Cầu)."
    Write-Host ""
    exit 1
}

if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) {
    Write-Host ""
    Write-Host "❌ Chưa cài dependencies."
    Write-Host "   → Mở PowerShell, vào thư mục dự án và chạy: npm install"
    Write-Host ""
    exit 1
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$DevScript`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Force | Out-Null

Write-Host ""
Write-Host "✅ Đã bật tự động khởi động dashboard"
Write-Host ""
Write-Host "   Bước tiếp theo:"
Write-Host "   1. Đăng xuất rồi đăng nhập lại (hoặc khởi động lại máy)"
Write-Host "   2. Đợi khoảng 30 giây"
Write-Host "   3. Mở trình duyệt: http://localhost:3000"
Write-Host ""
Write-Host "   Nhật ký (nếu cần kiểm tra lỗi):"
Write-Host "   - $LogDir\dev-server.log"
Write-Host ""
Write-Host "   Để tắt tự động khởi động, chạy: .\scripts\uninstall-windows-startup.ps1"
Write-Host ""
