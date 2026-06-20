import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { retrieve, contextBlock } from "@/lib/rag";
import { generate, type ChatMsg } from "@/lib/llm";
import { ROOMS } from "@/lib/data/knowledge";
import { detectDestination } from "@/lib/data/destinations";
import { isConfigured, searchHotels } from "@/lib/liteapi";

function ymd(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);
}

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .min(1),
});

export async function POST(req: Request) {
  await bootstrap();
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const messages = parsed.data.messages as ChatMsg[];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // KHÁCH SẠN THẬT: nếu khách nhắc tới một thành phố (ngoài resort), tự gọi LiteAPI
  // và trả về danh sách khách sạn thật ngay trong khung chat (ngày mặc định +7/+9, 2 khách).
  const dest = detectDestination(lastUser);
  if (dest && isConfigured()) {
    const checkIn = ymd(7);
    const checkOut = ymd(9);
    const hotelsUrl = `/hotels?dest=${encodeURIComponent(`${dest.cityName}|${dest.countryCode}`)}`;
    try {
      // Timeout tổng: dù LiteAPI chậm, chat vẫn phản hồi trong ~18s.
      const hotels = await Promise.race([
        searchHotels({
          cityName: dest.cityName,
          countryCode: dest.countryCode,
          checkin: checkIn,
          checkout: checkOut,
          adults: 2,
          limit: 10,
          enrich: 4,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LiteAPI timeout (chat)")), 18000)
        ),
      ]);
      if (hotels.length > 0) {
        const suggestedHotels = hotels.slice(0, 4).map((h) => ({
          hotelId: h.hotelId,
          offerId: h.offerId,
          name: h.name,
          image: h.image,
          address: h.address,
          city: h.city,
          rateName: h.rateName,
          price: h.price,
          currency: h.currency,
          rating: h.rating,
          starRating: h.starRating,
          checkIn: h.checkin,
          checkOut: h.checkout,
          guests: 2,
        }));
        const reply =
          `Đây là vài khách sạn thật ở **${dest.label}** mình tìm được ` +
          `(ngày mặc định ${checkIn} → ${checkOut}, 2 khách). ` +
          `Bấm **Chi tiết** để xem ảnh, mô tả & đặt; hoặc mở trang **Khách sạn** để đổi ngày/số khách. ` +
          `Mình vẫn có thể tư vấn thêm nếu bạn muốn so sánh hoặc cần ưu đãi nhé.`;
        return NextResponse.json({ reply, mode: "liteapi", suggestedHotels });
      }
      // Không có kết quả -> vẫn hướng khách sang trang Khách sạn
      return NextResponse.json({
        reply:
          `Mình chưa tìm thấy phòng trống ở **${dest.label}** cho ngày mặc định (${checkIn} → ${checkOut}). ` +
          `Bạn mở trang **[Khách sạn](${hotelsUrl})** để đổi ngày/số khách và tìm lại nhé. ` +
          `Hoặc mình tư vấn phòng tại An Lành Bay (Cam Ranh) nếu bạn muốn.`,
        mode: "liteapi",
      });
    } catch (e) {
      console.error("chat LiteAPI search error:", e);
      // Search lỗi/timeout -> không quay về tư vấn resort, mà hướng sang trang Khách sạn
      return NextResponse.json({
        reply:
          `Mình đang tra cứu khách sạn thật ở **${dest.label}** nhưng hệ thống phản hồi hơi chậm. ` +
          `Bạn mở trang **[Khách sạn](${hotelsUrl})** để xem phòng trống & giá realtime nhé. ` +
          `Mình vẫn có thể tư vấn phòng tại An Lành Bay (Cam Ranh) nếu bạn cần.`,
        mode: "liteapi",
      });
    }
  }

  // RETRIEVAL: lấy tri thức liên quan tới câu hỏi mới nhất (kèm chút ngữ cảnh trước đó)
  const recentContext = messages.slice(-4).map((m) => m.content).join(" ");
  const docs = retrieve(recentContext || lastUser, 5);
  const context = contextBlock(docs);

  // GENERATION
  const { text, mode } = await generate(context, messages);

  // Gợi ý phòng để hiển thị thẻ: ưu tiên phòng được nhắc tên trong câu trả lời,
  // sau đó tới phòng nằm trong tri thức truy xuất.
  const mentioned = ROOMS.filter((r) => text.toLowerCase().includes(r.name.toLowerCase())).map((r) => r.id);
  const fromDocs = docs.filter((d) => d.category === "room").map((d) => d.id.replace("room-", ""));
  const suggestedRoomIds = Array.from(new Set([...mentioned, ...fromDocs])).slice(0, 3);

  return NextResponse.json({ reply: text, mode, suggestedRoomIds });
}
