import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { retrieve, contextBlock } from "@/lib/rag";
import { generate, type ChatMsg } from "@/lib/llm";
import { ROOMS } from "@/lib/data/knowledge";
import { detectDestination } from "@/lib/data/destinations";
import { isConfigured, searchHotels } from "@/lib/liteapi";
import { parseGuests, parseMaxNightlyBudget, parseStayDates } from "@/lib/travel-query";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createOfferToken } from "@/lib/offer-token";

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))}đ`;
}

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
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // KHÁCH SẠN THẬT: thu thập đủ thông tin cơ bản trước khi gọi LiteAPI.
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const latestValue = <T,>(parser: (value: string) => T | null | undefined): T | null => {
    for (const value of [...userMessages].reverse()) {
      const parsedValue = parser(value);
      if (parsedValue !== null && parsedValue !== undefined) return parsedValue;
    }
    return null;
  };
  const dest = detectDestination(lastUser) || latestValue(detectDestination) || undefined;
  const parsedDates = latestValue(parseStayDates);
  const parsedGuests = latestValue(parseGuests);
  const maxNightlyBudget = latestValue(parseMaxNightlyBudget);

  if (dest && (!parsedDates || !parsedGuests)) {
    const missing = [
      !parsedDates ? "- **Ngày nhận và trả phòng** (ví dụ: 10/07 đến 12/07)" : null,
      !parsedGuests ? "- **Số khách** (người lớn và trẻ em nếu có)" : null,
    ].filter(Boolean).join("\n");
    const quickReplies = !parsedGuests
      ? ["2 người, dưới 1 triệu/đêm", "2 người, từ 1 đến 2 triệu/đêm", "Gia đình 4 người, dưới 2 triệu/đêm"]
      : [];

    return NextResponse.json({
      reply:
        `Được nhé, bạn muốn đi **${dest.label}**. Trước khi tìm khách sạn, mình cần thêm:\n\n` +
        `${missing}\n\n` +
        `Bạn cũng có thể cho biết **ngân sách mỗi đêm** và ưu tiên như gần biển, hồ bơi hoặc gần trung tâm. ` +
        `Ví dụ: “10/07 đến 12/07, 2 người, dưới 1 triệu/đêm, gần biển”.`,
      mode: "clarify",
      quickReplies,
    });
  }

  if (dest && isConfigured()) {
    const checkIn = parsedDates!.checkIn;
    const checkOut = parsedDates!.checkOut;
    const nights = Math.max(1, Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86_400_000));
    const guests = parsedGuests!;
    const hotelsUrl = `/hotels?dest=${encodeURIComponent(`${dest.cityName}|${dest.countryCode}`)}`;
    try {
      // Timeout tổng: dù LiteAPI chậm, chat vẫn phản hồi trong ~18s.
      const hotels = await Promise.race([
        searchHotels({
          cityName: dest.cityName,
          countryCode: dest.countryCode,
          checkin: checkIn,
          checkout: checkOut,
          adults: guests,
          limit: 30,
          enrich: 10,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("LiteAPI timeout (chat)")), 18000)
        ),
      ]);
      const matchingHotels = maxNightlyBudget
        ? hotels.filter((hotel) => hotel.price / nights <= maxNightlyBudget)
        : hotels;
      if (matchingHotels.length > 0) {
        const suggestedHotels = await Promise.all(matchingHotels.slice(0, 4).map(async (h) => ({
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
          guests,
          offerToken: await createOfferToken({
            offerId: h.offerId,
            hotelId: h.hotelId,
            name: h.name,
            roomDescription: h.rateName,
            checkIn: h.checkin,
            checkOut: h.checkout,
            guests,
          }),
        })));
        const budgetText = maxNightlyBudget
          ? `, đúng mức dưới **${formatVnd(maxNightlyBudget)}/đêm**`
          : "";
        const reply =
          `Đây là vài khách sạn thật ở **${dest.label}** mình tìm được${budgetText} ` +
          `(${checkIn} → ${checkOut}, ${guests} khách). ` +
          `Bấm **Chi tiết** để xem ảnh, mô tả & đặt; hoặc mở trang **Khách sạn** để đổi ngày/số khách. ` +
          `Mình vẫn có thể tư vấn thêm nếu bạn muốn so sánh hoặc cần ưu đãi nhé.`;
        return NextResponse.json({ reply, mode: "liteapi", suggestedHotels });
      }
      if (hotels.length > 0 && maxNightlyBudget) {
        const cheapestNightly = Math.min(...hotels.map((hotel) => hotel.price / nights));
        return NextResponse.json({
          reply:
            `Mình chưa tìm thấy phòng ở **${dest.label}** dưới **${formatVnd(maxNightlyBudget)}/đêm** ` +
            `cho ngày ${checkIn} → ${checkOut}. Giá thấp nhất hiện tại khoảng ` +
            `**${formatVnd(cheapestNightly)}/đêm**. Bạn có thể đổi ngày trên trang ` +
            `**[Khách sạn](${hotelsUrl})** để tìm mức giá khác.`,
          mode: "liteapi",
        });
      }
      // Không có kết quả -> vẫn hướng khách sang trang Khách sạn
      return NextResponse.json({
        reply:
          `Mình chưa tìm thấy phòng trống ở **${dest.label}** cho ngày ${checkIn} → ${checkOut}. ` +
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
