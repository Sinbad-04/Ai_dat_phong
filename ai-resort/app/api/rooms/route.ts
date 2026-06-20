import { NextResponse } from "next/server";
import { ROOMS, PACKAGES, SEASONAL } from "@/lib/data/knowledge";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ rooms: ROOMS, packages: PACKAGES, seasonal: SEASONAL });
}
