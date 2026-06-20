import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";

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
