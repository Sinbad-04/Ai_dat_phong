import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { isConfigured, prebook, sdkPublicKey } from "@/lib/liteapi";
import { createBooking } from "@/lib/db";
import { validateStayDates } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { verifyOfferToken } from "@/lib/offer-token";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  offerId: z.string().min(1).max(200),
  hotelId: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  roomDescription: z.string().trim().max(500).optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().min(1).max(9),
  offerToken: z.string().min(20),
});

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { namespace: "prebook", limit: 10, windowMs: 60 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
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
  const trusted = await verifyOfferToken(parsed.data.offerToken);
  if (!trusted || trusted.offerId !== parsed.data.offerId) {
    return NextResponse.json(
      { error: "Thông tin ưu đãi không hợp lệ hoặc đã hết hạn. Vui lòng tìm lại." },
      { status: 400 }
    );
  }
  const o = trusted;
  const stay = validateStayDates(o.checkIn, o.checkOut);
  if (stay.error) return NextResponse.json({ error: stay.error }, { status: 400 });

  try {
    // 1) Khoá giá & lấy thông tin cho Payment SDK
    const pb = await prebook(o.offerId);
    if (!pb.transactionId || !pb.secretKey || !pb.prebookId) {
      return NextResponse.json({ error: "Prebook không trả đủ thông tin thanh toán." }, { status: 502 });
    }

    // 2) Tạo đơn ở trạng thái chờ thanh toán, gắn transactionId để xác nhận sau
    const booking = await createBooking({
      user_id: user.id,
      room_id: o.hotelId,
      room_name: `${o.name}${o.roomDescription ? " — " + o.roomDescription : ""}`,
      check_in: o.checkIn,
      check_out: o.checkOut,
      guests: o.guests,
      package_id: null,
      nights: stay.nights,
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
