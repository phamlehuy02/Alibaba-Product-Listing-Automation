#!/usr/bin/env bash
# Starts the Next.js dev server (used by macOS LaunchAgent and manual runs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/dev-server.log"

mkdir -p "$LOG_DIR"

if command -v lsof >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
fi

cd "$PROJECT_DIR"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') Starting dev server ==="
  npm run dev
} >>"$LOG_FILE" 2>&1
