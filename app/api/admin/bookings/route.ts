import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { getBookingById, getUserById, listAllBookings, setBookingStatus } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  await bootstrap();
  const u = await getSessionUser();
  if (!u || u.role !== "admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const bookings = await listAllBookings();
  return NextResponse.json({ bookings });
}

const patch = z.object({
  id: z.string(),
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export async function PATCH(req: Request) {
  await bootstrap();
  const u = await getSessionUser();
  if (!u || u.role !== "admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = patch.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const booking = await getBookingById(parsed.data.id);
  if (!booking) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  const allowed: Record<string, string[]> = {
    pending: ["confirmed", "cancelled"],
    payment_pending: ["cancelled"],
    confirmed: [],
    cancelled: [],
  };
  if (!allowed[booking.status]?.includes(parsed.data.status)) {
    return NextResponse.json({ error: "Không thể chuyển sang trạng thái này" }, { status: 409 });
  }
  await setBookingStatus(parsed.data.id, parsed.data.status);
  const owner = await getUserById(booking.user_id);
  if (owner) {
    await sendEmail({
      to: owner.email,
      subject: `Đơn ${booking.id}: ${parsed.data.status === "confirmed" ? "đã xác nhận" : "đã hủy"}`,
      text: `Trạng thái đơn ${booking.id} cho ${booking.room_name} đã chuyển thành ${parsed.data.status}.`,
    }).catch((error) => console.error("Booking status email failed:", error));
  }
  return NextResponse.json({ ok: true });
}
