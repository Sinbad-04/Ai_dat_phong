import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { createBooking, listBookingsByUser, findRoom } from "@/lib/db";
import { PACKAGES } from "@/lib/data/knowledge";

export const runtime = "nodejs";

// Đơn phòng tĩnh của resort
const staticSchema = z.object({
  roomId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(10),
  packageId: z.string().nullable().optional(),
  notes: z.string().max(500).optional(),
});

// Đơn từ trang "Khách sạn" cho offer FALLBACK (static-*) khi chưa cấu hình LiteAPI.
// Offer thật của LiteAPI KHÔNG đi đường này — phải qua /api/hotels/prebook + /api/hotels/book.
const fallbackOfferSchema = z.object({
  offer: z.object({
    offerId: z.string(),
    hotelId: z.string(),
    name: z.string(),
    roomDescription: z.string().optional(),
    checkIn: z.string(),
    checkOut: z.string(),
  }),
  guests: z.number().int().min(1).max(10),
  notes: z.string().max(500).optional(),
});

function nightsBetween(a: string, b: string) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export async function GET() {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  const bookings = await listBookingsByUser(user.id);
  return NextResponse.json({ bookings });
}

export async function POST(req: Request) {
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
    const nights = nightsBetween(offer.checkIn, offer.checkOut);
    if (!Number.isFinite(nights) || nights < 1) {
      return NextResponse.json({ error: "Ngày trả phòng phải sau ngày nhận phòng" }, { status: 400 });
    }
    if (guests > room.capacity) {
      return NextResponse.json(
        { error: `Phòng ${room.name} chỉ tối đa ${room.capacity} khách` },
        { status: 400 }
      );
    }
    const total = room.basePrice * nights;
    const booking = await createBooking({
      user_id: user.id,
      room_id: room.id,
      room_name: room.name,
      check_in: offer.checkIn,
      check_out: offer.checkOut,
      guests,
      package_id: null,
      nights,
      total_price: total,
      deposit: Math.round(total * 0.3),
      currency: "VND",
      source: "static",
      provider_ref: null,
      transaction_id: null,
      status: "pending",
      notes: notes ?? null,
    });
    return NextResponse.json({ booking });
  }

  // ---- Nhánh đặt phòng tĩnh của resort ----
  const parsed = staticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { roomId, checkIn, checkOut, guests, packageId, notes } = parsed.data;

  const room = findRoom(roomId);
  if (!room) return NextResponse.json({ error: "Không tìm thấy phòng" }, { status: 404 });
  const nights = nightsBetween(checkIn, checkOut);
  if (!Number.isFinite(nights) || nights < 1) {
    return NextResponse.json({ error: "Ngày trả phòng phải sau ngày nhận phòng" }, { status: 400 });
  }
  if (guests > room.capacity) {
    return NextResponse.json(
      { error: `Phòng ${room.name} chỉ tối đa ${room.capacity} khách` },
      { status: 400 }
    );
  }

  let total = room.basePrice * nights;
  const pkg = packageId ? PACKAGES.find((p) => p.id === packageId) : null;
  if (pkg) total += Math.round(pkg.fromPrice * 0.15);

  const booking = await createBooking({
    user_id: user.id,
    room_id: room.id,
    room_name: room.name,
    check_in: checkIn,
    check_out: checkOut,
    guests,
    package_id: pkg?.id ?? null,
    nights,
    total_price: total,
    deposit: Math.round(total * 0.3),
    currency: "VND",
    source: "static",
    provider_ref: null,
    transaction_id: null,
    status: "pending",
    notes: notes ?? null,
  });
  return NextResponse.json({ booking });
}
