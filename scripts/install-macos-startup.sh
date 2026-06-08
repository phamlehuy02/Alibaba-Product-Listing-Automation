#!/usr/bin/env bash
# One-time setup: start the dashboard automatically when you log in to your Mac.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.alibaba-listing-bot.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.alibaba-listing-bot.dev.plist"
LABEL="com.alibaba-listing-bot.dev"
UID="$(id -u)"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Không tìm thấy Node.js."
  echo "   → Cài Node.js từ https://nodejs.org/ (xem README — mục Yêu Cầu)."
  exit 1
fi

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
  echo "❌ Chưa cài dependencies."
  echo "   → Mở Terminal, vào thư mục dự án và chạy: npm install"
  exit 1
fi

mkdir -p "$PROJECT_DIR/logs"
chmod +x "$SCRIPT_DIR/dev-server.sh"

sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$PLIST_SRC" > "$PLIST_DEST"

launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || true
launchctl unload "$PLIST_DEST" 2>/dev/null || true

if launchctl bootstrap "gui/$UID" "$PLIST_DEST" 2>/dev/null; then
  :
else
  launchctl load -w "$PLIST_DEST"
fi

echo ""
echo "✅ Đã bật tự động khởi động dashboard"
echo ""
echo "   Bước tiếp theo:"
echo "   1. Khởi động lại máy (hoặc đăng xuất rồi đăng nhập lại)"
echo "   2. Đợi khoảng 30 giây"
echo "   3. Mở trình duyệt: http://localhost:3000"
echo ""
echo "   Nhật ký (nếu cần kiểm tra lỗi):"
echo "   - $PROJECT_DIR/logs/dev-server.log"
echo "   - $PROJECT_DIR/logs/launchd.err.log"
echo ""
echo "   Để tắt tự động khởi động, chạy: ./scripts/uninstall-macos-startup.sh"
echo ""
