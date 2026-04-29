# ☕ Alibaba Coffee Listing Bot

Dashboard tự động đăng sản phẩm lên Alibaba.com dành cho nhà xuất khẩu cà phê. Nhập thông tin sản phẩm, bot sẽ đăng lên tài khoản Alibaba của bạn qua API chính thức.

---

## Yêu Cầu Trước Khi Bắt Đầu

1. **Máy tính có kết nối internet** (Windows, Mac, hoặc Linux)
2. **Node.js** (phiên bản 18 trở lên) — [tải tại đây](https://nodejs.org/)
3. **Tài khoản bán hàng trên Alibaba.com** đã kích hoạt Open Platform
4. **App Key và App Secret** từ [Alibaba Open Platform](https://open.alibaba.com/)

> **Chưa có App Key / App Secret?** Đăng nhập tài khoản Alibaba → vào "My Alibaba" → "Open Platform" → tạo ứng dụng mới. Bạn sẽ nhận được App Key và App Secret.

---

## Hướng Dẫn Cài Đặt (Từng Bước)

### Bước 1: Cài đặt dự án

Mở terminal (Command Prompt trên Windows, Terminal trên Mac) và điều hướng đến thư mục dự án. Sau đó chạy:

```
npm install
```

Lệnh này tải tất cả các gói cần thiết. Có thể mất 1–2 phút.

### Bước 2: Nhập thông tin đăng nhập

Mở file **`.env.local`** trong thư mục gốc của dự án (dùng Notepad, VS Code, hoặc trình soạn thảo bất kỳ).

Thay các giá trị mẫu bằng thông tin thật của bạn:

```
ALIBABA_APP_KEY=app_key_của_bạn
ALIBABA_APP_SECRET=app_secret_của_bạn
NEXT_PUBLIC_ALIBABA_APP_KEY=app_key_của_bạn
```

**Lưu file.** Giữ nguyên các dòng khác.

> ⚠️ **Không bao giờ chia sẻ App Secret với bất kỳ ai.** Nó giống như mật khẩu tài khoản Alibaba của bạn.

### Bước 3: Khởi chạy dashboard

Chạy lệnh sau trong terminal:

```
npm run dev
```

Bạn sẽ thấy kết quả như sau:

```
▲ Next.js 16.x.x
- Local: http://localhost:3000
✓ Ready
```

### Bước 4: Mở dashboard

Mở trình duyệt (Chrome, Edge, Firefox) và truy cập:

```
http://localhost:3000
```

Bạn sẽ thấy **Alibaba Bot Dashboard** với danh sách campaign.

### Bước 5: Kết nối tài khoản Alibaba

Đây là bước thực hiện **một lần duy nhất** để cho phép bot truy cập tài khoản Alibaba của bạn.

1. Trên dashboard, nhấn **"Settings"** (hoặc truy cập `http://localhost:3000/settings`)
2. Nhấn nút **"Open Alibaba Authorization"** — trang Alibaba sẽ mở trong tab mới
3. Đăng nhập và nhấn **"Authorize"** để cấp quyền
4. Sau khi xác nhận, trình duyệt sẽ chuyển đến một trang không tải được — **đó là bình thường**
5. **Sao chép toàn bộ URL** trên thanh địa chỉ trình duyệt (ví dụ: `https://example.com/callback?code=3_502296_AbCdEf...`)
6. Quay lại trang Settings, **dán URL vào ô "Paste the redirect URL here"** — mã sẽ được trích xuất tự động
7. Nhấn **"Connect"**
8. Bạn sẽ thấy thông báo xanh **"Successfully Authenticated"**

✅ **Xong!** Bot đã kết nối. Token được lưu tự động và sẽ tự làm mới khi hết hạn.

> **Nếu kết nối tự động không hoạt động**, bạn có thể dùng phần "Manual Token Exchange" phía dưới để nhập mã thủ công.

---

## Cách Sử Dụng

### Tạo Campaign Mới

1. Trên dashboard, nhấn **"+ New Campaign"**
2. Điền thông tin sản phẩm cà phê:
   - **Title** — tên sản phẩm (ví dụ: "Premium Vietnam Arabica Coffee Beans")
   - **Roast Level** — mức rang: Light, Medium, Dark, hoặc Italian
   - **Bean Variety** — giống: Arabica, Robusta, Liberica, Excelsa, hoặc Blend
   - **Origin** — xuất xứ (ví dụ: "Vietnam", "Brazil")
   - **Processing** — phương pháp chế biến: Washed, Natural, Honey, hoặc Giling Basah
   - **Description** — mô tả chi tiết sản phẩm
   - **Price** — giá bán (USD/kg)
   - **MOQ** — số lượng đặt hàng tối thiểu (kg)
3. Ô trạng thái ở góc dưới bên phải hiển thị **"Ready for Sync"** (xanh) khi tất cả trường bắt buộc đã được điền
4. Nhấn **"Save & Start Automation"**
5. Campaign sẽ xuất hiện trên dashboard

### Tối Ưu Bằng AI (Tùy Chọn)

Nếu bạn có [Google Gemini API key](https://aistudio.google.com/apikey), bạn có thể dùng AI để tạo tiêu đề và mô tả tối ưu:

1. Thêm key vào file `.env.local`:
   ```
   NEXT_PUBLIC_GEMINI_API_KEY=gemini_key_của_bạn
   ```
2. Khởi động lại dashboard (`Ctrl+C` rồi `npm run dev`)
3. Trong form tạo sản phẩm, nhấn **"AI Optimize"** — AI sẽ viết lại tiêu đề và mô tả cho SEO tốt hơn

Tính năng này hoàn toàn tùy chọn. Bot vẫn hoạt động bình thường không cần AI.

### Quản Lý Campaign

- **Tạm dừng/Tiếp tục** — nhấn nút Pause hoặc Resume bên cạnh campaign
- **Xem tất cả campaign** — hiển thị trên dashboard chính
- Campaign được lưu trong file `campaigns.json` và không bị mất khi khởi động lại

---

## Dừng Bot

Để dừng dashboard, vào terminal đang chạy và nhấn **`Ctrl + C`**.

Để chạy lại, gõ `npm run dev`.

---

## Xử Lý Sự Cố

| Vấn đề | Giải pháp |
|---|---|
| `npm install` lỗi | Kiểm tra [Node.js](https://nodejs.org/) đã cài chưa. Chạy `node --version` — cần v18+. |
| Dashboard không khởi động | Kiểm tra file `.env.local` tồn tại và có App Key / App Secret. |
| "Alibaba credentials not configured" | Thêm App Key và App Secret vào `.env.local` rồi khởi động lại. |
| "No access token found" | Thực hiện Bước 5 ở trên (kết nối tài khoản Alibaba). |
| Token hết hạn | Token tự làm mới. Nếu vẫn lỗi, lặp lại Bước 5 để lấy mã mới. |
| AI Optimize không hoạt động | Bình thường — nghĩa là chưa đặt Gemini API key. Bot vẫn chạy không cần AI. |

---

## Cấu Trúc Dự Án

```
├── .env.local              ← Thông tin đăng nhập bí mật (không chia sẻ file này)
├── tokens.json             ← Token xác thực (tự động lưu)
├── campaigns.json          ← Dữ liệu campaign
├── src/
│   ├── app/                ← Các trang dashboard
│   │   ├── page.tsx        ← Dashboard chính
│   │   ├── settings/       ← Cài đặt & kết nối tài khoản
│   │   ├── api/auth/       ← Xử lý OAuth tự động
│   │   └── actions/        ← Logic phía server
│   ├── components/         ← Giao diện (form sản phẩm)
│   └── lib/                ← Logic cốt lõi
│       ├── alibaba-api.ts  ← API client & ký request
│       ├── ai-optimizer.ts ← Tạo nội dung bằng AI (tùy chọn)
│       ├── automation-engine.ts ← Tự động đăng theo lịch
│       └── campaign-manager.ts  ← Quản lý campaign
```

---

Được xây dựng cho nhà xuất khẩu cà phê muốn tự động hóa việc đăng sản phẩm trên Alibaba.com.
