import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { consumePasswordResetToken } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128),
});

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, { namespace: "reset-password", limit: 10, windowMs: 60 * 60_000 });
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await bootstrap();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const updated = await consumePasswordResetToken(tokenHash, await hashPassword(parsed.data.password));
    if (!updated) return NextResponse.json({ error: "Liên kết không hợp lệ hoặc đã hết hạn" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/reset-password]", error);
    const message = error instanceof Error ? error.message : "Đặt lại mật khẩu thất bại";
    return NextResponse.json({ error: message || "Đặt lại mật khẩu thất bại" }, { status: 500 });
  }
}
