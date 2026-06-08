# Starts the Next.js dev server (used by Windows Task Scheduler and manual runs).
$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ProjectDir "logs"
$LogFile = Join-Path $LogDir "dev-server.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

try {
    Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch {
    $lines = netstat -ano | Select-String ":3000\s+.*LISTENING"
    foreach ($line in $lines) {
        $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
        $processId = $parts[-1]
        if ($processId -match '^\d+$') {
            Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
        }
    }
}

Set-Location $ProjectDir
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path $LogFile -Value "=== $timestamp Starting dev server ==="
npm run dev *>> $LogFile
