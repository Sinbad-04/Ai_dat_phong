import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { isConfigured, book } from "@/lib/liteapi";
import { getBookingByTransactionId, finalizeBooking } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({ transactionId: z.string() });

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { namespace: "complete-booking", limit: 20, windowMs: 60 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ error: "Chưa cấu hình LiteAPI." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thiếu transactionId" }, { status: 400 });

  // Tìm đơn chờ thanh toán đã tạo ở bước prebook (theo transactionId của chính user)
  const draft = await getBookingByTransactionId(parsed.data.transactionId, user.id);
  if (!draft) return NextResponse.json({ error: "Không tìm thấy đơn tương ứng." }, { status: 404 });
  if (draft.status === "confirmed") {
    return NextResponse.json({ booking: draft, alreadyConfirmed: true });
  }
  if (draft.status !== "payment_pending") {
    return NextResponse.json({ error: "Trạng thái đơn không cho phép hoàn tất thanh toán." }, { status: 409 });
  }
  if (!draft.provider_ref) {
    return NextResponse.json({ error: "Đơn thiếu prebookId." }, { status: 400 });
  }

  const { firstName, lastName } = splitName(user.name || user.email);
  try {
    const result = await book({
      prebookId: draft.provider_ref,
      transactionId: parsed.data.transactionId,
      holder: { firstName, lastName, email: user.email },
    });
    await finalizeBooking(draft.id, result.confirmationCode || result.bookingId || null);
    return NextResponse.json({
      booking: { ...draft, status: "confirmed" },
      confirmationCode: result.confirmationCode || result.bookingId || null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Hoàn tất đặt phòng thất bại" }, { status: 502 });
  }
}
