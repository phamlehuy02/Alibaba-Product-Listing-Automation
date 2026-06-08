# Turn off automatic dashboard startup on Windows.
$ErrorActionPreference = "Stop"

$TaskName = "AlibabaListingBotDev"

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Đã tắt tự động khởi động dashboard"
Write-Host "   Dashboard sẽ không tự chạy khi bạn đăng nhập nữa."
Write-Host "   Muốn chạy thủ công: npm run dev"
Write-Host ""
