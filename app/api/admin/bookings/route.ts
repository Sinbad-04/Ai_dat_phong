import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { listAllBookings, setBookingStatus } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  await bootstrap();
  const u = await getSessionUser();
  if (!u || u.role !== "admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const bookings = await listAllBookings();
  return NextResponse.json({ bookings });
}

const patch = z.object({
  id: z.string(),
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export async function PATCH(req: Request) {
  await bootstrap();
  const u = await getSessionUser();
  if (!u || u.role !== "admin")
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = patch.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  await setBookingStatus(parsed.data.id, parsed.data.status);
  return NextResponse.json({ ok: true });
}
