import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  await bootstrap();
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
  });
}
