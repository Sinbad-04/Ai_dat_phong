import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { cancelBookingByUser, createStaticBookingIfAvailable, listBookingsByUser, findRoom } from "@/lib/db";
import { PACKAGES } from "@/lib/data/knowledge";
import { validateStayDates } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Đơn phòng tĩnh của resort
const staticSchema = z.object({
  roomId: z.string().min(1).max(100),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(10),
  packageId: z.string().nullable().optional(),
  guestName: z.string().trim().min(2, "Họ tên phải có ít nhất 2 ký tự").max(100, "Họ tên quá dài"),
  guestEmail: z.string().trim().email("Email không hợp lệ").max(254, "Email quá dài"),
  guestPhone: z.string().trim().min(8, "Số điện thoại không hợp lệ").max(20, "Số điện thoại quá dài")
    .refine((value) => /^\+?[0-9\s.-]+$/.test(value) && value.replace(/\D/g, "").length >= 8, "Số điện thoại không hợp lệ"),
  guestAddress: z.string().trim().min(5, "Địa chỉ phải có ít nhất 5 ký tự").max(250, "Địa chỉ quá dài"),
  notes: z.string().trim().max(500).optional(),
});

// Đơn từ trang "Khách sạn" cho offer FALLBACK (static-*) khi chưa cấu hình LiteAPI.
// Offer thật của LiteAPI KHÔNG đi đường này — phải qua /api/hotels/prebook + /api/hotels/book.
const fallbackOfferSchema = z.object({
  offer: z.object({
    offerId: z.string().min(1).max(200),
    hotelId: z.string().min(1).max(200),
    name: z.string().min(1).max(200),
    roomDescription: z.string().max(500).optional(),
    checkIn: z.string(),
    checkOut: z.string(),
  }),
  guests: z.number().int().min(1).max(10),
  notes: z.string().trim().max(500).optional(),
});

async function notifyCreated(email: string, roomName: string, checkIn: string, checkOut: string, id: string) {
  await sendEmail({
    to: email,
    subject: `Đã tiếp nhận đơn ${id}`,
    text: `An Lành Bay đã tiếp nhận đơn ${id} cho ${roomName}, từ ${checkIn} đến ${checkOut}. Đơn đang chờ xác nhận/thanh toán.`,
  }).catch((error) => console.error("Booking email failed:", error));
}

export async function GET() {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const bookings = await listBookingsByUser(user.id);
  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { namespace: "create-booking", limit: 20, windowMs: 60 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // ---- Nhánh fallback offer (chỉ static-*) ----
  if (body && typeof body === "object" && "offer" in body) {
    const parsed = fallbackOfferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { offer, guests, notes } = parsed.data;
    if (!offer.offerId.startsWith("static-")) {
      return NextResponse.json(
        { error: "Khách sạn thật phải đặt qua bước thanh toán. Vui lòng dùng nút Đặt phòng ở trang Khách sạn." },
        { status: 400 }
      );
    }
    const room = findRoom(offer.offerId.replace("static-", ""));
    if (!room) return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
    const stay = validateStayDates(offer.checkIn, offer.checkOut);
    if (stay.error) return NextResponse.json({ error: stay.error }, { status: 400 });
    if (guests > room.capacity) {
      return NextResponse.json(
        { error: `Phòng ${room.name} chỉ tối đa ${room.capacity} khách` },
        { status: 400 }
      );
    }
    const total = room.basePrice * stay.nights;
    const booking = await createStaticBookingIfAvailable({
      user_id: user.id,
      room_id: room.id,
      room_name: room.name,
      check_in: offer.checkIn,
      check_out: offer.checkOut,
      guests,
      package_id: null,
      nights: stay.nights,
      total_price: total,
      deposit: Math.round(total * 0.3),
      currency: "VND",
      source: "static",
      provider_ref: null,
      transaction_id: null,
      status: "pending",
      guest_name: user.name,
      guest_email: user.email,
      guest_phone: null,
      guest_address: null,
      notes: notes ?? null,
    }, room.inventory);
    if (!booking) return NextResponse.json({ error: "Hạng phòng đã hết trong khoảng ngày này" }, { status: 409 });
    await notifyCreated(user.email, booking.room_name, booking.check_in, booking.check_out, booking.id);
    return NextResponse.json({ booking });
  }

  // ---- Nhánh đặt phòng tĩnh của resort ----
  const parsed = staticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { roomId, checkIn, checkOut, guests, packageId, guestName, guestEmail, guestPhone, guestAddress, notes } = parsed.data;

  const room = findRoom(roomId);
  if (!room) return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
  const stay = validateStayDates(checkIn, checkOut);
  if (stay.error) return NextResponse.json({ error: stay.error }, { status: 400 });
  if (guests > room.capacity) {
    return NextResponse.json(
      { error: `Phòng ${room.name} chỉ tối đa ${room.capacity} khách` },
      { status: 400 }
    );
  }

  let total = room.basePrice * stay.nights;
  const pkg = packageId ? PACKAGES.find((p) => p.id === packageId) : null;
  if (packageId && !pkg) return NextResponse.json({ error: "Gói trải nghiệm không hợp lệ" }, { status: 400 });
  if (pkg) total += Math.round(pkg.fromPrice * 0.15);

  const booking = await createStaticBookingIfAvailable({
    user_id: user.id,
    room_id: room.id,
    room_name: room.name,
    check_in: checkIn,
    check_out: checkOut,
    guests,
    package_id: pkg?.id ?? null,
    nights: stay.nights,
    total_price: total,
    deposit: Math.round(total * 0.3),
    currency: "VND",
    source: "static",
    provider_ref: null,
    transaction_id: null,
    status: "pending",
    guest_name: guestName,
    guest_email: guestEmail.toLowerCase(),
    guest_phone: guestPhone,
    guest_address: guestAddress,
    notes: notes ?? null,
  }, room.inventory);
  if (!booking) return NextResponse.json({ error: "Hạng phòng đã hết trong khoảng ngày này" }, { status: 409 });
  await notifyCreated(guestEmail, booking.room_name, booking.check_in, booking.check_out, booking.id);
  return NextResponse.json({ booking });
}

const cancelSchema = z.object({ id: z.string().min(1).max(100) });

export async function PATCH(req: Request) {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Mã đơn không hợp lệ" }, { status: 400 });
  const booking = await cancelBookingByUser(parsed.data.id, user.id);
  if (!booking) {
    return NextResponse.json(
      { error: "Không tìm thấy đơn hoặc đơn không còn được phép hủy" },
      { status: 409 }
    );
  }
  return NextResponse.json({ booking });
}
