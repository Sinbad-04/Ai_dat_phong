import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getUserByEmail, createUser } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2, "Tên quá ngắn"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export async function POST(req: Request) {
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
}
