# ☕ Alibaba Coffee Listing Bot

Dashboard để kết nối tài khoản Alibaba.com, tải danh sách sản phẩm hiện có, và đăng **listing mới** qua API chính thức.

> **Chỉ dùng 3 bước trong README này:** (1) Xác thực → (2) Load from Alibaba → (3) Post listings.  
> **Không dùng** các tính năng khác trên giao diện (New campaign, AI Optimize, v.v.) — chúng không nằm trong quy trình hỗ trợ và có thể gây dữ liệu không mong muốn.

---

## Yêu Cầu Trước Khi Bắt Đầu

1. **Máy tính có kết nối internet** (Windows, Mac, hoặc Linux)
2. **Node.js** (phiên bản 18 trở lên) — [tải tại đây](https://nodejs.org/)
3. **Tài khoản bán hàng trên Alibaba.com** đã kích hoạt Open Platform
4. **App Key và App Secret** từ [Alibaba Open Platform](https://open.alibaba.com/)

> **Chưa có App Key / App Secret?** Đăng nhập tài khoản Alibaba → vào "My Alibaba" → "Open Platform" → tạo ứng dụng mới. Bạn sẽ nhận được App Key và App Secret.

---

## Cài Đặt & Khởi Chạy

### Bước 1: Cài đặt dự án

```bash
npm install
```

### Bước 2: Cấu hình `.env.local`

Tạo hoặc mở file **`.env.local`** ở thư mục gốc:

```env
ALIBABA_APP_KEY=app_key_của_bạn
ALIBABA_APP_SECRET=app_secret_của_bạn
NEXT_PUBLIC_ALIBABA_APP_KEY=app_key_của_bạn

# Tùy chọn: số sản phẩm tải về khi bấm "Load from Alibaba" (mặc định 100)
SYNC_PRODUCT_LIMIT=100
```

> ⚠️ **Không chia sẻ App Secret.** Không commit `.env.local`, `tokens.json`, hoặc `campaigns.json`.

### Bước 3: Chạy dashboard

```bash
npm run dev
```

Mở trình duyệt: **http://localhost:3000**

> **Muốn dashboard tự chạy mỗi khi bật máy?**  
> Làm **một lần** theo hướng dẫn: [Tự động khởi động dashboard](docs/auto-start.md)  
> (chọn hướng dẫn **Mac** hoặc **Windows** trong file đó)

---

## Quy Trình Sử Dụng (3 Bước)

### ⚠️ Chỉ dùng các bước dưới đây

| Được phép | Không dùng |
|-----------|------------|
| **Settings** → kết nối Alibaba | **+ New campaign** / form tạo sản phẩm thủ công |
| **Load from Alibaba** | **AI Optimize** |
| **Post listings** | Các tab / nút khác ngoài Dashboard + Settings |

Dữ liệu sản phẩm dùng cho đăng listing được lấy từ bước **Load from Alibaba** (lưu cục bộ trong `campaigns.json`). Không có lịch tự động — mọi lần đăng listing đều do bạn bấm **Post listings**.

---

### 1. Xác thực (Authentication) — một lần

1. Vào **Settings**: http://localhost:3000/settings  
2. Nhấn **Open Alibaba authorization** → đăng nhập Alibaba → **Authorize**  
3. Sau khi authorize, trình duyệt có thể chuyển tới trang lỗi — **bình thường**  
4. **Sao chép toàn bộ URL** trên thanh địa chỉ (có tham số `code=...`)  
5. Dán URL vào ô trên trang Settings (mã được trích tự động)  
6. Nhấn **Connect**  
7. Thấy thông báo xác thực thành công → token lưu vào `tokens.json` (tự động, không cần sửa tay)

**Kiểm tra:** Quay lại Dashboard — các nút **Load from Alibaba** và **Post listings** không còn bị vô hiệu vì “chưa kết nối”.

**Nếu hết hạn token:** Lặp lại các bước trên trên trang Settings.

---

### 2. Load from Alibaba

Dùng khi bạn muốn (hoặc cần) cập nhật danh sách sản phẩm từ tài khoản Alibaba vào dashboard.

1. Mở **Dashboard**: http://localhost:3000  
2. Nhấn **Load from Alibaba** (góc trên)  
3. Đợi đến khi tải xong (có thể vài phút). **Giữ tab mở** trong lúc chạy  
4. Bảng **Your products** hiển thị các dòng đã lưu (tối đa `SYNC_PRODUCT_LIMIT`, sắp xếp theo **Last updated** trên Alibaba)

**Lưu ý:**

- Lần mở dashboard **không** tự động gọi Alibaba — chỉ đọc file đã lưu cho đến khi bạn bấm **Load from Alibaba**  
- Đây là **tải / đồng bộ danh sách** để xem và dùng làm nguồn cho bước 3, **không** phải đăng sản phẩm mới  
- Số lượng trên Alibaba (ví dụ ~1.900) có thể lớn hơn số dòng trong app — app chỉ lấy **N sản phẩm cập nhật gần nhất** (`SYNC_PRODUCT_LIMIT`)

---

### 3. Post listings

Dùng khi bạn muốn **tạo listing mới** trên Alibaba (bản sao / biến thể dựa trên sản phẩm đã load).

1. Đảm bảo đã **xác thực** (bước 1) và đã **Load from Alibaba** ít nhất một lần (bước 2)  
2. Trên Dashboard, nhấn **Post listings**  
3. Đợi batch chạy xong (tối đa **5** listing mỗi lần bấm, cách nhau vài giây). **Giữ tab mở** — có thể mất vài phút  
4. Khi xong:
   - Thông báo xanh: số listing đăng thành công  
   - Tab **Listing history**: sản phẩm nào đã chạy bot gần đây  

**Điều gì xảy ra mỗi lần bấm:**

- Bot chọn ngẫu nhiên **5** sản phẩm từ **500** sản phẩm cập nhật gần nhất trong danh sách đã load  
- Với mỗi sản phẩm: clone schema từ sản phẩm gốc trên Alibaba, điền title / ảnh / giá / thuộc tính / từ khóa / vận chuyển, rồi gọi API **tạo sản phẩm mới**  
- Listing mới trên Alibaba thường ở trạng thái **Pending** (chờ duyệt) cho đến khi Alibaba phê duyệt — app **không** tự chuyển sang Active  

**Lỗi:** Nếu thất bại, banner đỏ trên dashboard ghi lý do (kết nối, API Alibaba, v.v.). Xem thêm log trong terminal đang chạy `npm run dev`.

**CLI (tùy chọn):** Cùng logic batch từ terminal:

```bash
npm run post-now
```

---

## Dừng Dashboard

Trong terminal: **`Ctrl + C`**. Chạy lại: `npm run dev`.

---

## Xử Lý Sự Cố

| Vấn đề | Giải pháp |
|--------|-----------|
| `npm install` lỗi | Cài [Node.js](https://nodejs.org/) v18+. |
| Dashboard không mở | Kiểm tra `.env.local` có App Key / App Secret. |
| Nút Load / Post bị tắt | Làm lại **bước 1** (Settings → Connect). |
| Load from Alibaba lỗi | Kiểm tra token; thử Connect lại trên Settings. |
| Post listings — 0 thành công | Đọc thông báo lỗi trên dashboard và log terminal; đảm bảo đã Load from Alibaba trước. |
| Sản phẩm mới Pending trên Alibaba | Bình thường — chờ duyệt hoặc kiểm tra Seller Center, không phải lỗi nút Post. |
| Token hết hạn | Connect lại trên Settings. |

---

## Cấu Trúc Dự Án (tham khảo)

```
├── .env.local              ← App Key / Secret (không commit)
├── tokens.json             ← OAuth token (tự động, không commit)
├── campaigns.json          ← Sản phẩm đã load + lịch sử post (không commit)
├── src/app/page.tsx        ← Dashboard: Load from Alibaba, Post listings
├── src/app/settings/       ← Xác thực OAuth
└── src/lib/
    ├── automation-engine.ts  ← Logic Post listings
    └── sync-campaigns.ts     ← Logic Load from Alibaba
```

---

Được xây dựng cho nhà xuất khẩu cà phê cần quy trình rõ ràng: kết nối → tải sản phẩm → đăng listing mới theo yêu cầu.
