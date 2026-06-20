import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { isConfigured, prebook, sdkPublicKey } from "@/lib/liteapi";
import { createBooking } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  offerId: z.string(),
  hotelId: z.string(),
  name: z.string(),
  roomDescription: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(9),
});

function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.round((+new Date(b + "T00:00:00") - +new Date(a + "T00:00:00")) / 86400000));
}

export async function POST(req: Request) {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  if (!isConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình LiteAPI." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const o = parsed.data;

  try {
    // 1) Khoá giá & lấy thông tin cho Payment SDK
    const pb = await prebook(o.offerId);
    if (!pb.transactionId || !pb.secretKey || !pb.prebookId) {
      return NextResponse.json({ error: "Prebook không trả đủ thông tin thanh toán." }, { status: 502 });
    }

    // 2) Tạo đơn ở trạng thái chờ thanh toán, gắn transactionId để xác nhận sau
    const nights = nightsBetween(o.checkIn, o.checkOut);
    const booking = await createBooking({
      user_id: user.id,
      room_id: o.hotelId,
      room_name: `${o.name}${o.roomDescription ? " — " + o.roomDescription : ""}`,
      check_in: o.checkIn,
      check_out: o.checkOut,
      guests: o.guests,
      package_id: null,
      nights,
      total_price: pb.price,
      deposit: pb.price, // thanh toán toàn phần qua cổng LiteAPI
      currency: pb.currency,
      source: "liteapi",
      provider_ref: pb.prebookId,
      transaction_id: pb.transactionId,
      status: "payment_pending",
      notes: null,
    });

    // 3) Trả tham số cho Payment SDK ở frontend (KHÔNG kèm dữ liệu thẻ)
    return NextResponse.json({
      bookingId: booking.id,
      prebookId: pb.prebookId,
      transactionId: pb.transactionId,
      secretKey: pb.secretKey,
      publicKey: sdkPublicKey(),
      price: pb.price,
      currency: pb.currency,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Prebook thất bại" }, { status: 502 });
  }
}
