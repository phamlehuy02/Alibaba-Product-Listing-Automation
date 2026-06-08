# Tự động khởi động dashboard

## Bạn sẽ làm gì?

Sau khi làm **một lần** theo hướng dẫn dưới đây, dashboard Coffee Listing sẽ **tự chạy** mỗi khi bạn **bật máy và đăng nhập** — bạn không cần mở Terminal và gõ `npm run dev` mỗi ngày.

**Thành công khi:** Mở trình duyệt → vào **http://localhost:3000** → thấy dashboard (đợi khoảng 30 giây sau khi đăng nhập).

> **Lưu ý:** Dashboard chạy khi **bạn đăng nhập** vào tài khoản máy tính (không phải trước khi ai đó đăng nhập). Điều này là bình thường và giúp file cấu hình Alibaba (`.env.local`) hoạt động đúng.

---

## Trước khi bắt đầu (checklist)

Làm xong các mục sau (xem [README](../README.md) nếu chưa):

- [ ] Đã cài **Node.js** (phiên bản 18 trở lên)
- [ ] Đã chạy **`npm install`** một lần trong thư mục dự án
- [ ] Đã tạo file **`.env.local`** (App Key / App Secret)
- [ ] Đã mở được dashboard **thủ công** ít nhất một lần (`npm run dev` → http://localhost:3000)
- [ ] Biết **thư mục dự án** nằm ở đâu (ví dụ: `Documents/Codex/Alibaba-Product-Listing-Automation`)

---

## Cách bật tự động khởi động — Mac

### Bước 1: Mở Terminal

1. Nhấn **`Cmd + Space`** (phím Command + phím cách)
2. Gõ **`Terminal`**
3. Nhấn **Enter**

*Terminal* là cửa sổ dòng lệnh của Mac — bạn chỉ cần dùng nó cho bước cài đặt này.

### Bước 2: Vào thư mục dự án

Sao chép và dán dòng sau vào Terminal, **sửa đường dẫn** cho đúng vị trí thư mục trên máy bạn, rồi nhấn Enter:

```bash
cd ~/Documents/Codex/Alibaba-Product-Listing-Automation
```

### Bước 3: Chạy lệnh cài đặt

Sao chép và dán dòng này, nhấn Enter:

```bash
./scripts/install-macos-startup.sh
```

**Bạn sẽ thấy:** dòng `✅ Đã bật tự động khởi động dashboard` và hướng dẫn các bước tiếp theo.

Nếu thấy lỗi màu đỏ `❌`, đọc gợi ý ngay dưới dòng lỗi (thường là chưa cài Node.js hoặc chưa chạy `npm install`).

### Bước 4: Khởi động lại phiên đăng nhập

- **Khởi động lại máy**, hoặc
- **Đăng xuất** rồi **đăng nhập** lại

### Bước 5: Kiểm tra

1. Đợi khoảng **30 giây**
2. Mở trình duyệt (Chrome, Safari, …)
3. Vào địa chỉ: **http://localhost:3000**

Dashboard hiện ra là thành công.

---

## Cách bật tự động khởi động — Windows

### Bước 1: Mở PowerShell

1. Nhấn phím **Windows**
2. Gõ **`PowerShell`**
3. Chọn **Windows PowerShell** (không cần chọn “Run as administrator”)

*PowerShell* tương tự Terminal trên Mac — cửa sổ dòng lệnh của Windows.

### Bước 2: Cho phép chạy script (chỉ một lần)

Windows có thể chặn script lần đầu. Sao chép và dán dòng này, nhấn Enter:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Nếu hỏi xác nhận, gõ **`Y`** rồi Enter.

### Bước 3: Vào thư mục dự án

Sao chép và dán, **sửa đường dẫn** cho đúng, rồi Enter:

```powershell
cd C:\Users\TenBan\Documents\Codex\Alibaba-Product-Listing-Automation
```

### Bước 4: Chạy lệnh cài đặt

Sao chép và dán dòng này, nhấn Enter:

```powershell
.\scripts\install-windows-startup.ps1
```

**Bạn sẽ thấy:** dòng `✅ Đã bật tự động khởi động dashboard`.

### Bước 5: Đăng xuất và đăng nhập lại

Đăng xuất tài khoản Windows rồi đăng nhập lại (hoặc khởi động lại máy).

### Bước 6: Kiểm tra

1. Đợi khoảng **30 giây**
2. Mở trình duyệt
3. Vào: **http://localhost:3000**

---

## Làm sao biết đã chạy?

| Dấu hiệu | Ý nghĩa |
|----------|---------|
| http://localhost:3000 mở được | Dashboard đang chạy |
| Trang không mở được | Đợi thêm 30 giây rồi thử lại; xem mục Gặp lỗi bên dưới |

---

## Cách tắt tự động khởi động

### Mac

Mở Terminal, vào thư mục dự án, chạy:

```bash
./scripts/uninstall-macos-startup.sh
```

Bạn sẽ thấy: `✅ Đã tắt tự động khởi động dashboard`

### Windows

Mở PowerShell, vào thư mục dự án, chạy:

```powershell
.\scripts\uninstall-windows-startup.ps1
```

Hoặc mở **Task Scheduler** (Lập lịch tác vụ) → tìm tác vụ **`AlibabaListingBotDev`** → Disable hoặc Delete.

---

## Gặp lỗi?

### Dashboard không mở sau khi đăng nhập

1. Đợi **1 phút** rồi thử lại http://localhost:3000
2. Mở file nhật ký:
   - **Mac:** thư mục dự án → `logs` → `dev-server.log` (mở bằng TextEdit)
   - **Windows:** thư mục dự án → `logs` → `dev-server.log` (mở bằng Notepad)
3. Tìm dòng có chữ **`Ready`** — nếu có, server đã chạy; thử tải lại trang
4. Nếu file log trống hoặc có lỗi `node` / `npm`: cài lại Node.js và chạy `npm install` trong thư mục dự án

### Tôi vẫn phải mở Terminal mỗi ngày không?

**Không** — sau khi cài đặt một lần, máy tự chạy khi bạn đăng nhập.

### Tôi di chuyển thư mục dự án sang chỗ khác

Chạy lại script cài đặt (`install-macos-startup.sh` hoặc `install-windows-startup.ps1`) từ vị trí mới.

### Có ảnh hưởng tài khoản Alibaba trên web không?

**Không.** Script chỉ chạy dashboard trên máy tính của bạn.

### Dùng nvm / fnm trên Mac mà không chạy được

Đảm bảo cài Node qua nvm được khai báo trong file **`~/.zshrc`** (không chỉ `~/.zprofile`). Mở Terminal mới, gõ `node -v` — nếu có số phiên bản thì chạy lại script cài đặt.
