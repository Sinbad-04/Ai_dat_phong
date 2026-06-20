export default function PrivacyPage() {
  return (
    <article className="container-px prose mx-auto max-w-3xl py-12 text-ink/75">
      <h1 className="font-display text-3xl text-teal">Chính sách quyền riêng tư</h1>
      <p className="mt-4">Cập nhật ngày 21/06/2026.</p>
      <h2 className="mt-7 font-display text-xl text-teal">Dữ liệu được xử lý</h2>
      <p>Hệ thống xử lý họ tên, email, nội dung trò chuyện và thông tin đặt phòng để cung cấp dịch vụ. Hệ thống không nhận hoặc lưu số thẻ, CVV hay ngày hết hạn thẻ.</p>
      <h2 className="mt-7 font-display text-xl text-teal">Đơn vị cung cấp dịch vụ</h2>
      <p>Dữ liệu cần thiết có thể được chuyển tới nhà cung cấp khách sạn, cơ sở dữ liệu, mô hình AI và cổng thanh toán đã cấu hình. Chỉ dữ liệu cần cho từng tác vụ được gửi đi.</p>
      <h2 className="mt-7 font-display text-xl text-teal">Lưu trữ và quyền của người dùng</h2>
      <p>Người dùng có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu bằng cách liên hệ resort. Thời hạn lưu dữ liệu cần được cấu hình theo chính sách vận hành và pháp luật áp dụng trước khi triển khai chính thức.</p>
      <h2 className="mt-7 font-display text-xl text-teal">Bảo mật</h2>
      <p>Phiên đăng nhập dùng cookie HTTP-only; mật khẩu được băm. Không gửi mật khẩu hoặc thông tin thẻ qua khung chat.</p>
    </article>
  );
}

