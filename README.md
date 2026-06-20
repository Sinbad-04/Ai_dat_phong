# An Lành Bay — Trợ Lý Đặt Phòng & Tư Vấn Gói Nghỉ Dưỡng Thông Minh

> Đề tài **AI20K-194** · Lĩnh vực *Tourism — Booking Assistant* · Kỹ thuật **RAG + LLM**

Sản phẩm web **hoàn chỉnh**, deploy được online, gồm: trợ lý AI tư vấn phòng/gói nghỉ dưỡng (RAG + LLM), đăng nhập & phân quyền, đặt phòng, lịch sử đơn, và trang quản trị. Đây **không** phải notebook/CLI/prototype localhost — mà là một ứng dụng Next.js full-stack chạy thật, một cú bấm là deploy lên Vercel có URL công khai.

Khu nghỉ trong sản phẩm là hư cấu: **An Lành Bay Resort & Spa**, Bãi Dài, Cam Ranh, Khánh Hoà.

---

## 1. Đối chiếu với yêu cầu bắt buộc của đề

| Yêu cầu (bắt buộc) | Cách sản phẩm đáp ứng |
|---|---|
| Sản phẩm web/app **hoàn chỉnh** | Ứng dụng Next.js 14 full-stack: trang chủ, danh sách phòng, trợ lý AI, đặt phòng, lịch sử, trang admin |
| **Deployed online (có URL)** | Cấu hình sẵn để deploy Vercel 1 chạm; hướng dẫn từng bước ở mục 7 |
| **Đăng nhập & phân quyền cơ bản** | Đăng ký/đăng nhập bằng JWT (cookie HTTP-only), 2 vai trò: `user` và `admin`; middleware chặn route theo quyền |
| **Giao diện UI/UX hoàn chỉnh** | Thiết kế riêng "Hoàng hôn bên biển", responsive, có thẻ phòng, tóm tắt giá động, badge trạng thái |
| **Quản lý user** | Trang admin liệt kê toàn bộ user và đơn đặt; admin xác nhận/huỷ đơn |
| Hỏi nhu cầu khách (ngày, số người, ngân sách, mục đích) | Trợ lý "Lành" được prompt để khai thác nhu cầu tự nhiên |
| Tư vấn phòng/gói + giải thích | RAG truy xuất dữ liệu phòng/gói/chính sách rồi LLM giải thích; UI hiển thị thẻ phòng gợi ý |
| So sánh lựa chọn & ưu đãi | Tri thức có ưu đãi mùa (seasonal) và nhiều hạng phòng để so sánh |
| Trả lời chính sách (huỷ, trẻ em, thú cưng…) | Có sẵn trong kho tri thức (`lib/data/knowledge.ts`) |
| Gợi ý nâng hạng/dịch vụ thêm | Gói trải nghiệm (romance, family, wellness, workation) + nâng hạng phòng |
| Hỗ trợ hoàn tất đặt phòng | Form đặt phòng tính giá phía server, tạo đơn, lưu lịch sử |
| **Không xử lý dữ liệu thẻ** | Bước thanh toán chỉ *hướng dẫn* khách tự nhập trên cổng; app & prompt được ràng buộc **không hỏi/không lưu thẻ** |

---

## 2. Tính năng chính

- **Trợ lý AI (RAG + LLM).** Truy xuất tri thức (phòng, gói, ưu đãi mùa, chính sách) theo câu hỏi rồi đưa vào ngữ cảnh cho LLM trả lời. Tự gợi ý thẻ phòng phù hợp hiển thị ngay trong khung chat.
- **Chế độ Demo không cần API key.** Khi chưa cấu hình key, app vẫn chạy và trả lời dựa trên tri thức truy xuất — tiện cho việc chấm/demo. Gắn key vào là bật trả lời AI đầy đủ.
- **Xác thực & phân quyền.** Đăng ký, đăng nhập, đăng xuất; phiên JWT trong cookie HTTP-only; phân quyền `user`/`admin` bằng middleware.
- **Đặt phòng an toàn.** Giá (tổng + cọc 30%) được tính **phía server**, không tin client; kiểm tra số đêm và sức chứa.
- **Hướng dẫn thanh toán không chạm thẻ.** Hiển thị hướng dẫn chuyển khoản/cổng thanh toán, kèm ghi chú resort không lưu thông tin thẻ.
- **Trang quản trị.** Thống kê (tổng đơn, chờ xác nhận, doanh thu, số khách), bảng đơn đặt (xác nhận/huỷ), bảng người dùng.
- **Dữ liệu khách sạn thật (LiteAPI).** Trang `/hotels` tìm phòng trống & giá realtime qua LiteAPI; đặt phòng + thanh toán thật qua cổng hosted của LiteAPI (server không chạm thẻ); chưa cấu hình key thì tự fallback dữ liệu mẫu (chi tiết mục 12).

---

## 3. Công nghệ & kiến trúc

- **Next.js 14 (App Router, TypeScript)** — vừa là frontend, vừa là backend (API routes). Một codebase, deploy một nơi.
- **Postgres** (qua `postgres.js`) khi có `DATABASE_URL`; nếu để trống sẽ tự dùng **bộ nhớ tạm in-memory** (tiện dev nhanh, **không bền vững** — mất khi restart).
- **Xác thực:** `jose` (JWT, tương thích Edge) + `bcryptjs` (băm mật khẩu, thuần JS).
- **LLM:** mặc định gọi **ckey.vn** (API OpenAI-compatible, gộp GPT/Claude/Gemini…) bằng `fetch`; vẫn hỗ trợ gọi thẳng Anthropic/OpenAI. Không cần SDK.
- **RAG:** truy xuất từ vựng nhẹ, **bỏ dấu tiếng Việt** để khớp tốt, top-k = 5. Kho tri thức nhỏ & tĩnh nên không cần API embeddings.

Sơ đồ luồng chat:

```
Người dùng hỏi
   → /api/chat (kiểm tra đăng nhập)
   → retrieve(): tìm tri thức liên quan (phòng/gói/chính sách)
   → generate(): ghép tri thức vào system prompt → gọi Claude/OpenAI (hoặc demo)
   → trả lời + danh sách phòng gợi ý
   → UI render bong bóng chat + thẻ phòng
```

---

## 4. Chạy nhanh ở máy (local)

Yêu cầu: **Node.js ≥ 18**.

```bash
# 1) Cài thư viện
npm install

# 2) Tạo file môi trường (có thể để trống hết để chạy demo + in-memory)
cp .env.example .env.local

# 3) Chạy chế độ phát triển
npm run dev
# Mở http://localhost:3000
```

Mặc định (không cấu hình gì):
- Trợ lý chạy **demo mode** (trả lời dựa trên tri thức, chưa gọi AI thật).
- Dữ liệu lưu **in-memory** (mất khi tắt server).
- Vẫn có sẵn tài khoản admin: **admin@resort.vn / Admin@12345**.

Chạy bản production tại máy:

```bash
npm run build
npm run start
```

---

## 5. Cấu hình biến môi trường

Mở `.env.local` và điền khi cần (xem chi tiết trong `.env.example`):

| Biến | Ý nghĩa |
|---|---|
| `LLM_PROVIDER` | `ckey` (mặc định), `anthropic`, hoặc `openai` |
| `CKEY_API_KEY` | Key ckey.vn. Có key → bật trả lời AI đầy đủ |
| `CKEY_BASE_URL` | Mặc định `https://api.xah.io/v1` |
| `CKEY_MODEL` | Mặc định `gpt-4o-mini` (đổi sang model bất kỳ trong console ckey) |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Tuỳ chọn nếu muốn gọi thẳng provider đó |
| `DATABASE_URL` | Connection string Postgres. Trống → in-memory |
| `LITEAPI_API_KEY` | Key LiteAPI cho dữ liệu khách sạn thật. Trống → trang `/hotels` dùng dữ liệu mẫu |
| `LITEAPI_ENV` | `sandbox` (mặc định) hoặc `production` — phải khớp loại key |
| `JWT_SECRET` | Chuỗi bí mật ký JWT. Tạo: `openssl rand -base64 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Tài khoản admin được seed tự động lần đầu |

> **Bảo mật:** đổi `JWT_SECRET` và mật khẩu admin trước khi deploy thật.

---

## 6. Lấy API key (tuỳ chọn — không có vẫn chạy demo)

- **ckey.vn (LLM, mặc định):** đăng nhập https://ckey.vn → Open Console → tạo API key → dán vào `CKEY_API_KEY`. Giữ `LLM_PROVIDER=ckey`, `CKEY_BASE_URL=https://api.xah.io/v1`. Chọn model qua `CKEY_MODEL` (vd `gpt-4o-mini`, hoặc model Claude/Gemini trong console).
- **LiteAPI (khách sạn):** đăng ký https://dashboard.liteapi.travel → lấy sandbox key (tiền tố `sand_`) → dán vào `LITEAPI_API_KEY`, đặt `LITEAPI_ENV=sandbox`. Xem mục 12.
- *(Tuỳ chọn)* gọi thẳng Anthropic/OpenAI: điền `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` và đổi `LLM_PROVIDER`.

Schema cơ sở dữ liệu **tự tạo** ở lần gọi API đầu tiên (idempotent), không cần chạy lệnh init riêng.

---

## 7. Deploy online (Vercel + Postgres) — đáp ứng yêu cầu "có URL"

### Bước 1 — Tạo Postgres miễn phí (Neon)
1. Tạo tài khoản tại **neon.tech**, tạo một project.
2. Copy **connection string** (dạng `postgres://...`). Có thể dùng Supabase hoặc Vercel Postgres tương tự.

### Bước 2 — Đưa code lên GitHub
```bash
git init && git add . && git commit -m "AI20K-194 resort assistant"
git branch -M main
git remote add origin https://github.com/<tài-khoản>/<repo>.git
git push -u origin main
```

### Bước 3 — Deploy trên Vercel
1. Đăng nhập **vercel.com** bằng GitHub → **Add New → Project** → chọn repo.
2. Vercel tự nhận diện Next.js, giữ nguyên cấu hình build.
3. Vào **Environment Variables**, thêm:
   - `DATABASE_URL` = connection string Neon
   - `JWT_SECRET` = chuỗi ngẫu nhiên (`openssl rand -base64 32`)
   - `CKEY_API_KEY` (+ `LLM_PROVIDER=ckey`, `CKEY_BASE_URL=https://api.xah.io/v1`) — *bỏ qua nếu muốn để demo*
   - `LITEAPI_API_KEY` (+ `LITEAPI_ENV=sandbox`) — *bỏ qua nếu chỉ dùng dữ liệu mẫu*
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` (tuỳ chọn)
4. Bấm **Deploy**. Vài phút sau có **URL công khai** dạng `https://<tên-project>.vercel.app`.

### Bước 4 — Kiểm tra
- Mở URL, đăng ký một tài khoản, thử hỏi trợ lý, đặt một phòng.
- Đăng nhập admin (email/mật khẩu đã cấu hình) để xác nhận đơn.

> Bảng dữ liệu tự khởi tạo ở request đầu tiên; tài khoản admin tự seed theo `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

---

## 8. Tài khoản & phân quyền

- **Admin (mặc định):** `admin@resort.vn` / `Admin@12345` — đổi qua biến môi trường.
- **User thường:** tự đăng ký tại `/register`.
- Middleware bảo vệ: `/assistant`, `/bookings` yêu cầu đăng nhập; `/admin` yêu cầu vai trò `admin`.

---

## 9. Cấu trúc thư mục

```
ai-resort/
├─ app/
│  ├─ page.tsx              # Trang chủ (hero + chat mockup)
│  ├─ rooms/                # Danh sách phòng & gói
│  ├─ assistant/            # Khung chat trợ lý AI
│  ├─ bookings/             # Đặt phòng + lịch sử + hướng dẫn thanh toán
│  ├─ admin/                # Trang quản trị
│  ├─ login/ · register/    # Xác thực
│  └─ api/                  # Backend: auth, chat, rooms, bookings, admin
├─ lib/
│  ├─ data/knowledge.ts     # Kho tri thức: phòng, gói, ưu đãi, chính sách
│  ├─ rag.ts                # Truy xuất (bỏ dấu tiếng Việt, top-k)
│  ├─ llm.ts                # Ghép prompt + gọi Claude/OpenAI + demo mode
│  ├─ auth.ts               # JWT, băm mật khẩu, phiên
│  ├─ db.ts                 # Postgres hoặc in-memory
│  └─ bootstrap.ts          # Tạo schema + seed admin (idempotent)
├─ components/              # Navbar, RoomCard, HeroPrompt
├─ middleware.ts            # Bảo vệ route theo quyền
└─ .env.example
```

---

## 10. Ghi chú bảo mật thanh toán (theo yêu cầu đề)

Sản phẩm **tuyệt đối không hỏi và không lưu thông tin thẻ**. Ở bước thanh toán, ứng dụng chỉ:
- hiển thị số tiền cọc cần chuyển,
- hướng dẫn chuyển khoản / mở cổng thanh toán an toàn để khách **tự nhập**,
- ghi rõ resort không lưu dữ liệu thẻ.

System prompt của trợ lý cũng bị ràng buộc không thu thập thông tin thẻ.

---

## 11. Giả định & lựa chọn thiết kế

- **Chọn Next.js full-stack thay vì FastAPI + Next.js riêng:** đề gợi ý FastAPI nhưng yêu cầu cốt lõi là "web hoàn chỉnh, deploy có URL". Gộp vào Next.js giúp triển khai một chạm trên Vercel, vẫn đủ backend (API routes), auth, quản lý user và AI. Nếu cần tách microservice Python, có thể chuyển phần `lib/llm.ts` + `lib/rag.ts` sang FastAPI sau mà không đổi frontend.
- **RAG từ vựng thay vì embeddings:** kho tri thức nhỏ & tĩnh; truy xuất từ vựng bỏ dấu đủ chính xác, lại không phụ thuộc API embeddings (rẻ, nhanh, chạy được offline/demo).
- **Demo mode:** để sản phẩm luôn chạy được khi chấm dù chưa có API key.
- **Khu nghỉ, hình ảnh, giá là hư cấu** phục vụ minh hoạ.
- **LLM dùng ckey.vn:** một cổng OpenAI-compatible gộp nhiều model (GPT/Claude/Gemini…); chỉ cần trỏ `CKEY_BASE_URL` + `CKEY_API_KEY`, đổi model bằng `CKEY_MODEL`. Vẫn có thể gọi thẳng Anthropic/OpenAI.
- **Khách sạn dùng LiteAPI:** search + đặt + thanh toán hosted trong một nhà cung cấp; thẻ nhập trên cổng LiteAPI nên server không chạm dữ liệu thẻ (đúng yêu cầu đề).
- **Khu nghỉ, hình ảnh, giá mẫu là hư cấu** phục vụ minh hoạ.

---

## 12. Dữ liệu khách sạn thật + thanh toán qua LiteAPI

Dự án dùng **LiteAPI** để phần đặt phòng là thật: tìm phòng trống & giá realtime, và **thanh toán thật** qua cổng hosted — mà hệ thống vẫn **không chạm dữ liệu thẻ**.

### Luồng kỹ thuật
1. **Search** — `POST https://api.liteapi.travel/v3.0/hotels/rates` (theo cityName + countryCode) → danh sách phòng & giá. Auth bằng header `X-API-Key`.
2. **Prebook** — `POST .../rates/prebook` với `usePaymentSdk: true` → trả `prebookId`, `transactionId`, `secretKey`. Server tạo đơn ở trạng thái *Chờ thanh toán* và gắn `transactionId`.
3. **Payment SDK** — frontend nạp `https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js`, khởi tạo với `secretKey` + `returnUrl`. **Khách nhập thẻ trên cổng của LiteAPI**, không phải trên server của mình.
4. **Book** — sau khi thanh toán, khách được chuyển về `/booking/confirm?tid=...`; server gọi `POST https://book.liteapi.travel/v2.0/rates/book` với `payment.method = TRANSACTION_ID` để chốt đơn, rồi cập nhật trạng thái *Đã xác nhận*.

### Lấy API key
1. Đăng ký https://dashboard.liteapi.travel (Free Signup).
2. Lấy **sandbox key** (tiền tố `sand_`), dán vào `.env.local` / Vercel:
   ```
   LITEAPI_API_KEY=sand_xxx
   LITEAPI_ENV=sandbox
   ```
3. Mở `/hotels`, tìm phòng → bấm **Đặt phòng** → trang `/checkout` mở cổng thanh toán.
   Sandbox dùng thẻ thử **4242 4242 4242 4242**, CVV bất kỳ 3 số, hạn trong tương lai.

### Không xử lý dữ liệu thẻ (đúng yêu cầu đề)
Thẻ được nhập trực tiếp trên Payment SDK của LiteAPI. Server chỉ nhận `transactionId` sau khi thanh toán xong — **không bao giờ thấy số thẻ/CVV**. Endpoint `book` của LiteAPI cũng cho phép truyền thẻ thô, nhưng dự án **chỉ dùng `method: TRANSACTION_ID`** để giữ nguyên tắc này.

### Cơ chế fallback
Chưa cấu hình `LITEAPI_API_KEY` (hoặc API lỗi) → `/hotels` hiển thị dữ liệu mẫu của An Lành Bay (nhãn **“Dữ liệu mẫu (fallback)”**), và đặt phòng lưu thẳng vào DB + hướng dẫn cọc. App **không bao giờ vỡ** khi demo/chấm.

### Lưu ý
- **Sandbox** có kho giới hạn; thử Singapore/Bangkok/Paris để thấy nhiều dữ liệu. `LITEAPI_ENV=production` + key production cho kho đầy đủ (đặt thật sẽ trừ tiền thật + sinh hoa hồng).
- Điểm đến hỗ trợ sẵn nằm trong `lib/data/destinations.ts` (sửa/thêm cityName + countryCode theo `/data/cities` của LiteAPI).

### File liên quan
- `lib/liteapi.ts` — client LiteAPI (search, prebook, book).
- `lib/llm.ts` — gọi ckey.vn (OpenAI-compatible) + fallback demo.
- `app/api/hotels/route.ts` — tìm kiếm + fallback.
- `app/api/hotels/prebook/route.ts` — khoá giá + tạo đơn chờ thanh toán.
- `app/api/hotels/book/route.ts` — chốt đơn sau thanh toán (TRANSACTION_ID).
- `app/hotels/page.tsx`, `app/checkout/page.tsx`, `app/booking/confirm/page.tsx` — giao diện tìm → thanh toán → xác nhận.
