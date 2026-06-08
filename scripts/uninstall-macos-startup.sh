#!/usr/bin/env bash
# Turn off automatic dashboard startup on Mac.
set -euo pipefail

PLIST_DEST="$HOME/Library/LaunchAgents/com.alibaba-listing-bot.dev.plist"
LABEL="com.alibaba-listing-bot.dev"
UID="$(id -u)"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl unload "$PLIST_DEST" 2>/dev/null || true

if [[ -f "$PLIST_DEST" ]]; then
  rm -f "$PLIST_DEST"
fi

echo ""
echo "✅ Đã tắt tự động khởi động dashboard"
echo "   Dashboard sẽ không tự chạy khi bạn đăng nhập nữa."
echo "   Muốn chạy thủ công: npm run dev"
echo ""
