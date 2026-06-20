import { NextResponse } from "next/server";
import { usingMemory } from "@/lib/db";
import { isConfigured as liteApiConfigured } from "@/lib/liteapi";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  const production = process.env.NODE_ENV === "production";
  const checks = {
    database: usingMemory() ? "memory" : "configured",
    liteapi: liteApiConfigured() ? "configured" : "disabled",
    email: emailConfigured() ? "configured" : "disabled",
    jwt: !!process.env.JWT_SECRET,
  };
  const ready = !production || (checks.database === "configured" && checks.jwt);
  return NextResponse.json(
    { status: ready ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}

