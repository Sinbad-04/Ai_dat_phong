import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getUserByEmail, createUser } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  email: z.string().trim().email("Email không hợp lệ").max(254, "Email quá dài"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(128, "Mật khẩu quá dài"),
});

export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(req, { namespace: "register", limit: 5, windowMs: 15 * 60_000 });
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    await bootstrap();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, email, password } = parsed.data;
    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: "Email đã được đăng ký" }, { status: 409 });
    }
    const user = await createUser({
      name,
      email,
      password_hash: await hashPassword(password),
      role: "user",
    });
    await createSession(user);
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("[auth/register]", error);
    const message = error instanceof Error ? error.message : "Đăng ký thất bại";
    return NextResponse.json({ error: message || "Đăng ký thất bại" }, { status: 500 });
  }
}
