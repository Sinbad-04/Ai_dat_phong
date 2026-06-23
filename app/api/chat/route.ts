import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { type ChatMsg } from "@/lib/llm";
import { runConcierge } from "@/lib/agent/orchestrator";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4_000) }))
    .min(1)
    .max(30),
});

export async function POST(req: Request) {
  const rate = checkRateLimit(req, { namespace: "chat", limit: 30, windowMs: 10 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const messages = parsed.data.messages as ChatMsg[];
  const totalCharacters = messages.reduce((total, message) => total + message.content.length, 0);
  if (totalCharacters > 30_000) {
    return NextResponse.json({ error: "Ngữ cảnh hội thoại quá dài" }, { status: 400 });
  }

  // Agent LLM "Lành": tự đọc ngữ cảnh, hỏi thêm hoặc gọi công cụ (tìm khách sạn,
  // tư vấn điểm đến, tra cứu tri thức resort). Không còn cây if rule-base.
  const result = await runConcierge(messages);

  return NextResponse.json({
    reply: result.reply,
    mode: result.mode,
    ...(result.suggestedHotels ? { suggestedHotels: result.suggestedHotels } : {}),
    ...(result.suggestedRoomIds ? { suggestedRoomIds: result.suggestedRoomIds } : {}),
  });
}
