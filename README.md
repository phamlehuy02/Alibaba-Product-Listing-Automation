# ☕ Alibaba Coffee Listing Bot

Dashboard và CLI để kết nối Alibaba.com, đồng bộ catalog, và **nhân bản 5 listing** qua Seller Center (Playwright) — giống thao tác **Duplicate product** thủ công, với title được sắp xếp lại và ảnh nguồn được xác minh trước khi Submit.

> **Quy trình chính:** Cài đặt → **OAuth API (một lần)** → **Đăng nhập Seller Center Playwright (một lần)** → Chạy batch 5 listing.  
> **Load from Alibaba** trên dashboard là tùy chọn (xem catalog cục bộ), **không bắt buộc** cho Playwright duplicate.

---

## Yêu cầu

| Yêu cầu | Ghi chú |
|---------|---------|
| Node.js 18+ | [nodejs.org](https://nodejs.org/) |
| Tài khoản Alibaba Seller | Open Platform đã kích hoạt |
| App Key + App Secret | [open.alibaba.com](https://open.alibaba.com/) |
| Chromium (Playwright) | `npx playwright install chromium` |

---

## Cài đặt

```bash
npm install
npx playwright install chromium
```

### Cấu hình `.env.local`

```env
ALIBABA_APP_KEY=app_key_của_bạn
ALIBABA_APP_SECRET=app_secret_của_bạn
NEXT_PUBLIC_ALIBABA_APP_KEY=app_key_của_bạn

# Playwright (mặc định: cửa sổ browser có UI)
PLAYWRIGHT_HEADLESS=false
DUPLICATE_METHOD=playwright

# Tùy chọn
SYNC_PRODUCT_LIMIT=100
LISTING_POOL_TIMEZONE=America/Los_Angeles
# PHOTOBANK_GROUP_ID=
```

> Không commit `.env.local`, `tokens.json`, `campaigns.json`, `.playwright-profile/`.

Xem thêm biến trong [`.env.example`](.env.example).

---

## Luồng hoàn chỉnh (từ đăng nhập đến 5 listing)

```
┌─────────────────────────────────────────────────────────────────┐
│  MỘT LẦN: OAuth API (Settings)     → tokens.json               │
│  MỘT LẦN: Seller Center login      → .playwright-profile/     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MỖI LẦN CHẠY BATCH (5 listing)                                │
│  1. API: lấy pool theo Last updated (ngày lịch Seller Center) │
│  2. Chọn ngẫu nhiên 5 ID khác nhau trong pool                   │
│  3. Với mỗi ID — Playwright:                                    │
│     · Tải ảnh nguồn (API) → manifest cục bộ                   │
│     · Seller Center: tìm ID → Duplicate product                 │
│     · Đổi Product name (rearrange + verify)                     │
│     · Upload 6 ảnh (direct upload + verify sha256)              │
│     · Submit                                                    │
│  4. Ghi kết quả → scratch/listing-pairs.json                    │
└─────────────────────────────────────────────────────────────────┘
```

### Bước 1 — Xác thực Open API (một lần)

Cần cho: chọn pool sản phẩm, tải ảnh, photobank.

1. `npm run dev` → mở http://localhost:3000/settings  
2. **Open Alibaba authorization** → đăng nhập → **Authorize**  
3. Sao chép URL callback (có `code=...`) → dán vào Settings → **Connect**  
4. Token lưu tự động vào `tokens.json`

**Kiểm tra:** Dashboard — nút **Post listings** không còn báo chưa kết nối.

**Token hết hạn:** Lặp lại bước trên.

---

### Bước 2 — Đăng nhập Seller Center Playwright (một lần)

Cần cho: Duplicate product, sửa title, upload ảnh, Submit trên UI.

```bash
npm run playwright-login
```

1. Cửa sổ Chromium mở → đăng nhập Seller Center (captcha nếu có)  
2. Script phát hiện đã vào Seller Center → lưu session  
3. Session nằm tại `.playwright-profile/` và `storage-state.json` (gitignored)

**Lần sau:** `npm run playwright-login` báo session còn hiệu lực thì **không cần đăng nhập lại**.

**Hết phiên / lỗi auth:** Chạy lại `npm run playwright-login`.

---

### Bước 3 — (Tùy chọn) Load from Alibaba

Chỉ để **xem / đồng bộ catalog** trên dashboard (`campaigns.json`). **Không** dùng làm nguồn pool cho Playwright batch (pool lấy trực tiếp từ List API).

1. Dashboard → **Load from Alibaba**  
2. Đợi xong (giữ tab mở). Tối đa `SYNC_PRODUCT_LIMIT` sản phẩm, sắp theo Last updated

---

### Bước 4 — Chạy batch 5 listing

**Mặc định:** 5 sản phẩm ngẫu nhiên, **Last updated** trong khoảng **26–31 May 2026** (ngày lịch theo `LISTING_POOL_TIMEZONE`, mặc định `America/Los_Angeles` — khớp cột Last updated trên Seller Center).

#### Qua Dashboard

1. `npm run dev` (chạy **local**, không phải Vercel)  
2. Dashboard → **Post listings**

#### Qua CLI

```bash
npm run duplicate-playwright
# tương đương:
npm run post-now

# Tùy chỉnh khoảng ngày và số lượng:
npx tsx scripts/playwright-duplicate-batch.ts 2026-05-26 2026-06-01 5
```

**Kiểm tra pool trước khi chạy:**

```bash
npm run count-pool
# Ví dụ: Pool size: 62, May 31: 49 sản phẩm
```

#### Trong mỗi listing, script tự động

| Bước | Cách làm |
|------|----------|
| Chọn nguồn | Shuffle pool → 5 `product_id` **khác nhau** mỗi lần chạy (có thể trùng nguồn giữa các lần chạy khác) |
| Ảnh | `get/v2` → tải bytes → `scratch/playwright-images/{id}/` → upload từng ảnh qua nút **Upload** trên form |
| Title | Đọc title duplicate → `title-rearranger` → ghi `#productTitle` + verify |
| Verify ảnh | So khớp sha256 / file_id trước Submit (fail-closed) |
| Submit | Nút Submit trên form duplicate |

**Kết quả:**

- `scratch/listing-pairs.json` — cặp source → clone  
- `scratch/last-batch-result.json` — tóm tắt lần chạy gần nhất  
- `scratch/playwright-debug/` — screenshot khi lỗi

---

## Kiểm thử từng phần (khuyến nghị lần đầu)

```bash
# 1. Title only (không ảnh, không submit)
PLAYWRIGHT_STOP_AFTER_TITLE=true npm run duplicate-playwright

# 2. Một sản phẩm — title + ảnh + verify
npm run playwright-test-title -- <sourceProductId>
npm run playwright-test-images -- <sourceProductId>

# 3. Batch dừng sau ảnh (không submit)
PLAYWRIGHT_STOP_AFTER_IMAGES=true npm run duplicate-playwright

# 4. Full batch
npm run duplicate-playwright
```

Để giữ browser mở sau test: `PLAYWRIGHT_INSPECT_MS=60000 npm run playwright-test-title -- <id>`

---

## Biến môi trường (Playwright)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `DUPLICATE_METHOD` | `playwright` | `playwright` hoặc `api` (Open API cũ) |
| `PLAYWRIGHT_HEADLESS` | `false` | `true` = không hiện cửa sổ browser |
| `LISTING_POOL_TIMEZONE` | `America/Los_Angeles` | Múi giờ cột **Last updated** khi lọc pool |
| `PLAYWRIGHT_STOP_AFTER_TITLE` | — | `true` = dừng sau đổi title |
| `PLAYWRIGHT_STOP_AFTER_IMAGES` | — | `true` = dừng sau upload ảnh |
| `PLAYWRIGHT_INSPECT_MS` | `0` | Giữ browser mở N ms sau test script |
| `PHOTOBANK_GROUP_ID` | auto | Nhóm photobank khi upload ảnh qua API |

---

## Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| Pool quá ít (ví dụ 13) | Đảm bảo code mới dùng List API + `LISTING_POOL_TIMEZONE`. Chạy `npm run count-pool`. |
| `playwright-login` timeout | Đăng nhập xong trong cửa sổ Chromium; chạy lại. |
| Không tìm thấy Product name / ảnh | Xem `scratch/playwright-debug/*.png`; chạy lại `playwright-login`. |
| Image verify failed | Xem `scratch/playwright-debug/images-verify-*.json` |
| Title verify failed | Xem `scratch/playwright-debug/title-verify-*.json` |
| Token API hết hạn | Settings → Connect lại |
| Clone ở Draft | Submit qua UI tạo bản nháp; kiểm tra Seller Center |

---

## Cấu trúc dự án (tham khảo)

```
├── .env.local
├── tokens.json                    ← OAuth
├── .playwright-profile/           ← Seller Center session (một lần login)
├── campaigns.json                 ← Load from Alibaba (tùy chọn)
├── scratch/
│   ├── listing-pairs.json         ← Kết quả duplicate
│   ├── playwright-images/         ← Manifest + file ảnh tải về
│   └── playwright-debug/          ← Screenshot / JSON debug
├── scripts/
│   ├── playwright-login-once.ts
│   ├── playwright-duplicate-batch.ts
│   ├── playwright-test-title.ts
│   ├── playwright-test-images.ts
│   └── count-pool-range.ts
└── src/lib/
    ├── playwright-alibaba-auth.ts
    ├── playwright-duplicate.ts
    ├── playwright-duplicate-batch.ts
    ├── playwright-image-prep.ts
    ├── playwright-image-upload.ts
    ├── duplicate-pool.ts          ← Pool theo Last updated (List API)
    └── title-rearranger.ts
```

---

## Tự khởi động dashboard

Làm **một lần** theo [docs/auto-start.md](docs/auto-start.md) (Mac / Windows).

---

Được xây dựng cho nhà xuất khẩu cà phê: **OAuth một lần → Seller Center login một lần → tự động duplicate 5 listing** với title và ảnh đã kiểm tra.
