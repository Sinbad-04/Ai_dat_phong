import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { updateUserRole } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  await bootstrap();
  const u = await getSessionUser();
  if (!u || u.role !== "admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const users = (await listUsers()).map((x) => ({
    id: x.id, name: x.name, email: x.email, role: x.role, created_at: x.created_at,
  }));
  return NextResponse.json({ users });
}

const roleSchema = z.object({ id: z.string().min(1).max(100), role: z.enum(["user", "admin"]) });

export async function PATCH(req: Request) {
  await bootstrap();
  const current = await getSessionUser();
  if (!current || current.role !== "admin") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }
  const parsed = roleSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  if (parsed.data.id === current.id && parsed.data.role !== "admin") {
    return NextResponse.json({ error: "Không thể tự hạ quyền tài khoản đang đăng nhập" }, { status: 409 });
  }
  const updated = await updateUserRole(parsed.data.id, parsed.data.role);
  if (!updated) return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
