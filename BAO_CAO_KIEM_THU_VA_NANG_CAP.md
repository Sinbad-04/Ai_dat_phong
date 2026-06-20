# Báo cáo kiểm thử và nâng cấp hệ thống

Ngày thực hiện: 21/06/2026  
Trạng thái Git: thay đổi chỉ nằm ở máy local, **chưa commit và chưa push**.  
Commit gốc trước khi sửa: `e455662`.

## 1. Kết quả tổng quát

- Build production: đạt, 33 route.
- ESLint: đạt, 0 lỗi và 0 cảnh báo.
- Unit test: 8/8 đạt.
- HTTP smoke test: 25/25 đạt.
- `npm audit`: 0 lỗ hổng.
- Luồng LiteAPI/payment thật chưa thể chạy E2E trên máy local vì không có credential sandbox.
- PostgreSQL production chưa thể chạy E2E vì không có `DATABASE_URL` thử nghiệm.

## 2. Các thay đổi đã hoàn thành

### Dọn repository và chất lượng mã

- Xóa hoàn toàn cây source `ai-resort/` trùng lặp, bao gồm lockfile Next.js 14 có lỗ hổng.
- Chuyển lint sang ESLint CLI, không còn dùng `next lint` đã deprecated.
- Thêm các lệnh:
  - `npm run lint`
  - `npm test`
  - `npm run test:smoke`
  - `npm run check`
- Thêm unit test cho ngày lưu trú, ngân sách, số khách, ngày trong chat, rate limit và token offer.
- Thêm smoke test HTTP có thể chạy lại.

### Bảo mật

- Production bắt buộc có `JWT_SECRET` ngẫu nhiên tối thiểu 32 ký tự.
- Production bắt buộc có `ADMIN_PASSWORD` riêng, tối thiểu 12 ký tự và không được dùng mật khẩu demo.
- Xóa tài khoản admin/mật khẩu demo khỏi giao diện đăng nhập.
- Chặn open redirect qua tham số `next` của trang đăng nhập.
- Thêm rate limit cho đăng nhập, đăng ký, chat, tìm khách sạn, prebook, book và quên mật khẩu.
- Giới hạn độ dài email, tên, mật khẩu, tin nhắn, ghi chú và metadata booking.
- Thêm security headers: nosniff, deny iframe, referrer policy và permissions policy.
- Kết quả tìm kiếm LiteAPI có token ký 30 phút; prebook không còn tin metadata khách sạn/ngày do client tự gửi.
- API không gửi chi tiết lỗi nội bộ LiteAPI về trình duyệt.

### Đặt phòng và tồn kho

- Chặn ngày sai định dạng, ngày trả trước ngày nhận, ngày trong quá khứ và kỳ nghỉ quá 30 đêm.
- Thêm số lượng tồn cho từng hạng phòng.
- Chống overbooking:
  - In-memory kiểm tra số đơn trùng ngày.
  - PostgreSQL dùng transaction và advisory lock theo mã phòng.
- Chặn package không tồn tại.
- Người dùng có thể hủy đơn `pending` hoặc `payment_pending`.
- Admin chỉ được chuyển trạng thái hợp lệ:
  - `pending` → `confirmed` hoặc `cancelled`.
  - `payment_pending` → `cancelled`.
  - Đơn đã xác nhận/hủy không được chuyển ngược tùy tiện.
- API trả 404/409 đúng trường hợp thay vì luôn báo thành công.
- Doanh thu admin được tách đúng theo từng loại tiền tệ.
- Admin có thể thay đổi vai trò user/admin và không thể tự hạ quyền tài khoản hiện tại.
- Thêm phân trang 20 dòng trên màn hình quản trị.

### Thanh toán

- Xóa nút VNPay demo và số tài khoản giả.
- Phòng resort dùng quy trình chuyển khoản + admin đối soát; chỉ hiện thông tin ngân hàng khi đã cấu hình biến môi trường.
- Phòng LiteAPI tiếp tục dùng Payment SDK hosted, không nhận/lưu dữ liệu thẻ.
- Endpoint hoàn tất LiteAPI chỉ chấp nhận đơn ở trạng thái `payment_pending`.
- Transaction ID có unique index trong PostgreSQL.

### Tài khoản và email

- Mật khẩu người dùng tối thiểu 8, tối đa 128 ký tự.
- Thêm luồng quên mật khẩu:
  - Token ngẫu nhiên, chỉ lưu SHA-256 hash.
  - Hết hạn sau 30 phút.
  - Dùng một lần.
  - Response không tiết lộ email có tồn tại hay không.
- Tích hợp gửi email qua Resend khi có `RESEND_API_KEY` và `EMAIL_FROM`.
- Gửi email khi tạo đơn và khi admin xác nhận/hủy đơn nếu email đã cấu hình.

### Chat và tìm khách sạn

- Chat đọc ngày, số khách, điểm đến và ngân sách qua nhiều lượt hội thoại.
- Hỗ trợ ngày ISO và `dd/mm/yyyy`.
- Lọc đúng giá tối đa theo đêm.
- Tăng số kết quả được xét trước khi lọc ngân sách.
- Trang khách sạn có bộ lọc:
  - Giá tối đa/đêm.
  - Hạng sao.
  - Điểm đánh giá.
  - Tiện ích.
- Trang khách sạn nhận đúng điểm đến từ link trong chat.
- Hiển thị rõ tổng kỳ lưu trú và giá mỗi đêm.
- Bỏ giá OTA ước tính giả. Booking/Agoda/Traveloka/Google Hotels chỉ còn link kiểm tra giá thực tế.

### Vận hành và pháp lý

- Thêm `/api/health` để kiểm tra database, JWT, LiteAPI và email.
- Production trả health `503 degraded` nếu chưa có database bền vững hoặc JWT secret.
- Thêm trang `/privacy` và `/terms`.
- Bổ sung các biến môi trường ngân hàng, email và múi giờ trong `.env.example`.

## 3. Kết quả test tự động

### Unit test — 8/8 đạt

1. Rate limiter chặn đúng giới hạn và reset đúng cửa sổ.
2. Đọc ngân sách `< 1 triệu`, `900k`, `1,5tr`.
3. Đọc số khách và từ chối số khách ngoài giới hạn.
4. Đọc ngày ISO và ngày Việt Nam.
5. Chấp nhận khoảng ngày hợp lệ.
6. Từ chối ngày đảo ngược, ngày không tồn tại và kỳ nghỉ quá dài.
7. Từ chối ngày trong quá khứ.
8. Token offer xác minh đúng và từ chối token bị sửa.

### HTTP smoke test — 25/25 đạt

- Trang chủ trả 200.
- Route cần đăng nhập redirect 307.
- Health endpoint hoạt động.
- Danh mục phòng hoạt động.
- Tìm khách sạn từ chối ngày đảo ngược.
- Đăng ký và session hoạt động.
- Đặt phòng từ chối ngày quá khứ.
- Đặt phòng từ chối package sai.
- Tạo đủ 8/8 phòng cùng hạng thành công.
- Đơn thứ 9 bị chặn 409, xác nhận chống overbooking.
- Người dùng hủy đơn thành công.
- User thường bị chặn khỏi API admin.
- Quên mật khẩu không làm lộ tài khoản tồn tại.
- Admin đăng nhập và gọi API thành công.
- Admin xác nhận đơn pending thành công.
- Chuyển trạng thái sai bị chặn 409.

## 4. Biến môi trường bắt buộc trước production

```env
DATABASE_URL=postgres://...
JWT_SECRET=<chuỗi ngẫu nhiên tối thiểu 32 ký tự>
ADMIN_EMAIL=...
ADMIN_PASSWORD=<mật khẩu mạnh tối thiểu 12 ký tự>
APP_TIME_ZONE=Asia/Ho_Chi_Minh
```

Tùy tính năng:

```env
LITEAPI_API_KEY=...
LITEAPI_ENV=sandbox
RESEND_API_KEY=...
EMAIL_FROM=...
NEXT_PUBLIC_BANK_NAME=...
NEXT_PUBLIC_BANK_ACCOUNT=...
NEXT_PUBLIC_BANK_HOLDER=...
```

Không deploy production bằng in-memory database. Dữ liệu sẽ mất khi instance restart và rate limit in-memory không đồng bộ giữa nhiều instance.

## 5. Hạng mục cần credential/hệ thống ngoài để hoàn tất E2E

### LiteAPI webhook, hủy và hoàn tiền

Code hiện tại hoàn tất booking qua Payment SDK + API book. Chưa thêm webhook/hủy/refund vì cần:

- Tài liệu webhook và cơ chế xác minh chữ ký đúng với tài khoản LiteAPI đang dùng.
- Sandbox API key.
- Quyền/API cancellation/refund của tài khoản đối tác.
- URL webhook public để LiteAPI gọi lại.

Không nên tạo endpoint webhook giả hoặc nhận sự kiện không kiểm tra chữ ký. Sau khi có credential, cần test các ca: thanh toán thành công, thất bại, callback lặp, hủy trước hạn và hoàn tiền một phần/toàn phần.

### Email thật

Luồng và adapter đã có nhưng cần domain gửi đã xác minh tại Resend. Nếu chưa cấu hình, UI nói rõ email chưa sẵn sàng thay vì báo gửi thành công giả.

### CRUD phòng/gói bằng admin

Vai trò user và trạng thái đơn đã quản lý được. Danh mục phòng/gói hiện vẫn là knowledge base trong source để đảm bảo RAG, giá và tồn kho dùng cùng một nguồn. Muốn CRUD runtime cần chuyển catalog sang PMS/CMS hoặc bảng PostgreSQL, rồi đồng bộ lại RAG cache. Không nên thêm form CRUD chỉ ghi một nơi và làm giá/chat lệch dữ liệu.

### Monitoring/analytics bên ngoài

Đã có health endpoint và log lỗi server. Để production cần chọn nền tảng (Sentry, Axiom, Datadog hoặc Vercel Observability), cung cấp DSN/token và quy định dữ liệu được phép gửi.

## 6. Checklist test giao diện cho người duyệt

1. Chạy `npm run dev`.
2. Tạo tài khoản mới với mật khẩu từ 8 ký tự.
3. Thử URL `/login?next=https://example.com`, xác nhận sau login vẫn về `/assistant`.
4. Đặt một phòng với ngày tương lai, sau đó hủy trong “Đặt phòng của tôi”.
5. Thử ngày quá khứ và ngày trả trước ngày nhận, xác nhận UI hiển thị lỗi.
6. Vào “Khách sạn”, tìm và lọc theo giá/sao/đánh giá/tiện ích.
7. Chat: `Nha Trang từ 10/07/2099 đến 12/07/2099, 4 người, dưới 1 triệu/đêm`.
8. Đăng nhập admin local bằng credential dev trong `.env.local`, kiểm tra xác nhận/hủy đơn và đổi vai trò.
9. Mở `/api/health`.
10. Kiểm tra responsive trên mobile cho menu, bảng admin, thẻ khách sạn và chat.

## 7. Lệnh xác minh

```bash
npm ci
npm run check

# Cửa sổ 1
npm run dev -- -p 3100

# Cửa sổ 2
npm run test:smoke

npm audit
```

## 8. Khuyến nghị trước khi push/deploy

1. Người duyệt chạy checklist giao diện ở mục 6.
2. Tạo `.env.local` riêng; không commit secret.
3. Test migration trên một PostgreSQL staging.
4. Test LiteAPI sandbox bằng credential thật.
5. Chọn phương án PMS/CMS cho CRUD catalog nếu đây là yêu cầu bắt buộc.
6. Chỉ commit/push sau khi xác nhận diff xóa `ai-resort/` và các luồng UI mới.
