import { NextResponse } from "next/server";
import { z } from "zod";
import { bootstrap } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { retrieve, contextBlock } from "@/lib/rag";
import { generate, type ChatMsg } from "@/lib/llm";
import { ROOMS } from "@/lib/data/knowledge";
import {
  areasForDestination,
  detectDestination,
  detectDestinationArea,
  hotelMatchesArea,
} from "@/lib/data/destinations";
import { isConfigured, searchHotels } from "@/lib/liteapi";
import {
  declinesAreaPreference,
  declinesBudgetFilter,
  isGreetingOnly,
  parseGuests,
  parseMaxNightlyBudget,
  parseStayDates,
} from "@/lib/travel-query";
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

  if (isGreetingOnly(lastUser)) {
    return NextResponse.json({
      reply: "Chào bạn 👋 Mình là Lành, trợ lý du lịch của An Lành Bay. Hôm nay mình có thể giúp gì cho bạn?",
      mode: "greeting",
    });
  }

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
  const detectedArea = latestValue(detectDestinationArea);
  const area = dest && detectedArea?.cityName === dest.cityName && detectedArea.countryCode === dest.countryCode
    ? detectedArea
    : null;
  const availableAreas = dest ? areasForDestination(dest) : [];
  const skippedArea = userMessages.some(declinesAreaPreference);
  const parsedDates = latestValue(parseStayDates);
  const parsedGuests = latestValue(parseGuests);
  const maxNightlyBudget = latestValue(parseMaxNightlyBudget);
  const skippedBudget = userMessages.some(declinesBudgetFilter);

  if (dest && availableAreas.length > 0 && !area && !skippedArea) {
    return NextResponse.json({
      reply:
        `Bạn muốn ở khu vực nào tại **${dest.label}**? Chọn một khu vực bên dưới để mình tìm sát nhu cầu hơn.`,
      mode: "clarify",
      quickReplies: [...availableAreas.map((item) => item.label), "Không ưu tiên khu vực"],
    });
  }

  const locationLabel = area ? `${area.label}, ${dest?.label}` : dest?.label;

  if (dest && !parsedDates) {
    return NextResponse.json({
      reply: `Bạn dự định **nhận phòng và trả phòng ngày nào** tại ${locationLabel}? Ví dụ: “10/07 đến 12/07”.`,
      mode: "clarify",
    });
  }

  if (dest && !parsedGuests) {
    return NextResponse.json({
      reply: "Chuyến đi của bạn có bao nhiêu khách? Nếu có trẻ em, bạn ghi rõ giúp mình nhé.",
      mode: "clarify",
      quickReplies: ["1 người", "2 người", "Gia đình 4 người"],
    });
  }

  if (dest && !maxNightlyBudget && !skippedBudget) {
    return NextResponse.json({
      reply: "Bạn muốn ngân sách phòng tối đa khoảng bao nhiêu mỗi đêm?",
      mode: "clarify",
      quickReplies: [
        "Không quá 1 triệu/đêm",
        "Không quá 2 triệu/đêm",
        "Không quá 3 triệu/đêm",
        "Xem tất cả mức giá",
      ],
    });
  }

  if (dest && isConfigured()) {
    const checkIn = parsedDates!.checkIn;
    const checkOut = parsedDates!.checkOut;
    const nights = Math.max(1, Math.round((+new Date(checkOut) - +new Date(checkIn)) / 86_400_000));
    const guests = parsedGuests!;
    const hotelsQuery = new URLSearchParams({ dest: `${dest.cityName}|${dest.countryCode}` });
    if (area) hotelsQuery.set("area", area.value);
    const hotelsUrl = `/hotels?${hotelsQuery.toString()}`;
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
      const areaHotels = area ? hotels.filter((hotel) => hotelMatchesArea(hotel, area)) : hotels;
      if (area && hotels.length > 0 && areaHotels.length === 0) {
        return NextResponse.json({
          reply:
            `Mình chưa thấy phòng khớp chính xác khu **${area.label}** trong dữ liệu hiện tại. ` +
            `Bạn có thể **[mở trang Khách sạn](${hotelsUrl})** để đổi khu vực hoặc chọn “Không ưu tiên khu vực”.`,
          mode: "liteapi",
        });
      }
      const matchingHotels = maxNightlyBudget
        ? areaHotels.filter((hotel) => hotel.price / nights <= maxNightlyBudget)
        : areaHotels;
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
          `Đây là vài khách sạn thật ở **${locationLabel}** mình tìm được${budgetText} ` +
          `(${checkIn} → ${checkOut}, ${guests} khách). ` +
          `Bấm **Chi tiết** để xem ảnh, mô tả & đặt; hoặc mở trang **Khách sạn** để đổi ngày/số khách. ` +
          `Mình vẫn có thể tư vấn thêm nếu bạn muốn so sánh hoặc cần ưu đãi nhé.`;
        return NextResponse.json({ reply, mode: "liteapi", suggestedHotels });
      }
      if (areaHotels.length > 0 && maxNightlyBudget) {
        const cheapestNightly = Math.min(...areaHotels.map((hotel) => hotel.price / nights));
        return NextResponse.json({
          reply:
            `Mình chưa tìm thấy phòng ở **${locationLabel}** dưới **${formatVnd(maxNightlyBudget)}/đêm** ` +
            `cho ngày ${checkIn} → ${checkOut}. Giá thấp nhất hiện tại khoảng ` +
            `**${formatVnd(cheapestNightly)}/đêm**. Bạn có thể đổi ngày trên trang ` +
            `**[Khách sạn](${hotelsUrl})** để tìm mức giá khác.`,
          mode: "liteapi",
        });
      }
      // Không có kết quả -> vẫn hướng khách sang trang Khách sạn
      return NextResponse.json({
        reply:
          `Mình chưa tìm thấy phòng trống ở **${locationLabel}** cho ngày ${checkIn} → ${checkOut}. ` +
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
