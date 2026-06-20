import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { createPasswordResetToken } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, { namespace: "forgot-password", limit: 5, windowMs: 60 * 60_000 });
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await bootstrap();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await createPasswordResetToken(
      parsed.data.email,
      tokenHash,
      new Date(Date.now() + 30 * 60_000).toISOString()
    );
    if (user && emailConfigured()) {
      const resetUrl = new URL("/reset-password", request.url);
      resetUrl.searchParams.set("token", token);
      await sendEmail({
        to: user.email,
        subject: "Đặt lại mật khẩu An Lành Bay",
        text: `Liên kết đặt lại mật khẩu có hiệu lực 30 phút: ${resetUrl.toString()}\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    }
    return NextResponse.json({
      ok: true,
      message: "Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.",
      emailDeliveryConfigured: emailConfigured(),
    });
  } catch (error) {
    console.error("[auth/forgot-password]", error);
    const message = error instanceof Error ? error.message : "Gửi yêu cầu thất bại";
    return NextResponse.json({ error: message || "Gửi yêu cầu thất bại" }, { status: 500 });
  }
}
