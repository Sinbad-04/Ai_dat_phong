// lib/agent/tools.ts
// Các công cụ (tool) mà agent "Lành" có thể gọi. Mỗi công cụ chỉ lo MỘT việc
// (chia nhỏ thay vì 1 prompt tổng) và TỰ KIỂM ĐỊNH dữ liệu đầu vào ở phía server:
// - Không bịa: thiếu/không hợp lệ -> trả lỗi rõ ràng để model HỎI LẠI khách.
// - Giá/khách sạn/chính sách chỉ đến từ nguồn thật (LiteAPI / tri thức resort).
import type { AgentToolSpec } from "@/lib/llm";
import { isConfigured, searchHotels } from "@/lib/liteapi";
import {
  areasForDestination,
  detectDestination,
  detectDestinationArea,
  guideForArea,
  guideForDestination,
  hotelMatchesArea,
  DESTINATIONS,
  type Destination,
  type DestinationArea,
} from "@/lib/data/destinations";
import { retrieve, contextBlock } from "@/lib/rag";
import { ROOMS } from "@/lib/data/knowledge";
import { createOfferToken } from "@/lib/offer-token";
import { validateStayDates, todayYmd } from "@/lib/validation";

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(value))}đ`;
}

// Trạng thái phụ trợ thu thập trong một lượt: thẻ khách sạn, phòng gợi ý, mode hiển thị.
export type ToolRunContext = {
  suggestedHotels: any[];
  suggestedRoomIds: string[];
  modes: Set<string>;
};

export function createToolContext(): ToolRunContext {
  return { suggestedHotels: [], suggestedRoomIds: [], modes: new Set() };
}

// ---- Định nghĩa công cụ (JSON schema) gửi cho LLM ----
export const TOOL_SPECS: AgentToolSpec[] = [
  {
    name: "find_hotels",
    description:
      "Tìm khách sạn THẬT theo điểm đến + ngày + số khách. CHỈ gọi khi đã có đủ city, checkIn, checkOut và guests do KHÁCH nói rõ. " +
      "Tuyệt đối KHÔNG tự suy đoán/điền giúp ngày hay số khách — thiếu thì hỏi khách trước.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Điểm đến, vd 'Phú Quốc', 'Đà Nẵng', 'Hà Nội', 'Nha Trang'." },
        area: { type: "string", description: "Khu vực cụ thể trong điểm đến nếu khách nêu, vd 'Bãi Trường', 'Hồ Tây'. Bỏ trống nếu khách không nói." },
        checkIn: { type: "string", description: "Ngày nhận phòng dạng YYYY-MM-DD (chỉ điền khi khách nói rõ)." },
        checkOut: { type: "string", description: "Ngày trả phòng dạng YYYY-MM-DD (phải sau checkIn)." },
        guests: { type: "integer", description: "Số khách người lớn (1-9), chỉ điền khi khách nói rõ." },
        maxNightlyBudget: { type: "integer", description: "Ngân sách tối đa MỖI ĐÊM tính bằng VND, chỉ điền khi khách nêu." },
      },
      required: ["city", "checkIn", "checkOut", "guests"],
    },
  },
  {
    name: "get_destination_guide",
    description:
      "Lấy thông tin tư vấn về một điểm đến hoặc khu vực (lý do nên đến, trải nghiệm nổi bật, các khu vực có thể chọn). " +
      "Dùng khi khách hỏi 'có gì chơi/đẹp', muốn gợi ý điểm đến hoặc cần chọn khu vực.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string", description: "Điểm đến cần tư vấn." },
        area: { type: "string", description: "Khu vực cụ thể nếu khách quan tâm. Bỏ trống để lấy thông tin chung của điểm đến." },
      },
      required: ["city"],
    },
  },
  {
    name: "search_resort_knowledge",
    description:
      "Tra cứu tri thức của khu nghỉ An Lành Bay (Cam Ranh): loại phòng, giá tham chiếu, gói nghỉ dưỡng, tiện ích, chính sách (huỷ phòng, trẻ em, thú cưng, thanh toán...). " +
      "Dùng khi khách hỏi về phòng/gói/chính sách của An Lành Bay. Chỉ trả lời dựa trên dữ liệu trả về.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Câu hỏi/từ khoá cần tra cứu, vd 'chính sách huỷ phòng', 'phòng cho gia đình', 'gói trăng mật'." },
      },
      required: ["query"],
    },
  },
];

function hotelsPageUrl(dest: Destination, area: DestinationArea | null, checkIn: string, checkOut: string, guests: number): string {
  const query = new URLSearchParams({
    dest: `${dest.cityName}|${dest.countryCode}`,
    checkin: checkIn,
    checkout: checkOut,
    adults: String(guests),
  });
  if (area) query.set("area", area.value);
  return `/hotels?${query.toString()}`;
}

async function runFindHotels(args: Record<string, unknown>, ctx: ToolRunContext): Promise<unknown> {
  const cityRaw = typeof args.city === "string" ? args.city : "";
  const dest = cityRaw ? (detectDestination(cityRaw) as Destination | undefined) : undefined;
  if (!dest) {
    return {
      ok: false,
      error: `Mình chưa hỗ trợ điểm đến "${cityRaw || "(trống)"}".`,
      supportedDestinations: DESTINATIONS.map((d) => d.label),
    };
  }

  const guestsRaw = args.guests;
  const guests = typeof guestsRaw === "number" ? Math.round(guestsRaw) : NaN;
  if (!Number.isInteger(guests) || guests < 1 || guests > 9) {
    return {
      ok: false,
      error: "Số khách phải là số nguyên từ 1 đến 9. Hãy hỏi lại khách đoàn có mấy người, đừng tự điền.",
    };
  }

  const checkIn = typeof args.checkIn === "string" ? args.checkIn.trim() : "";
  const checkOut = typeof args.checkOut === "string" ? args.checkOut.trim() : "";
  const dates = validateStayDates(checkIn, checkOut);
  if (dates.error) {
    return { ok: false, error: `${dates.error}. Hôm nay là ${todayYmd()}. Hãy hỏi lại khách ngày nhận/trả phòng.` };
  }
  const nights = dates.nights;

  // Khu vực (tuỳ chọn): chỉ nhận khi khớp đúng điểm đến.
  let area: DestinationArea | null = null;
  if (typeof args.area === "string" && args.area.trim()) {
    const detected = detectDestinationArea(args.area) as DestinationArea | undefined;
    if (detected && detected.cityName === dest.cityName && detected.countryCode === dest.countryCode) {
      area = detected;
    }
  }

  let maxNightlyBudget: number | null = null;
  if (typeof args.maxNightlyBudget === "number" && args.maxNightlyBudget > 0) {
    maxNightlyBudget = Math.round(args.maxNightlyBudget);
  }

  const pageUrl = hotelsPageUrl(dest, area, checkIn, checkOut, guests);
  const locationLabel = area ? `${area.label}, ${dest.label}` : dest.label;

  if (!isConfigured()) {
    return {
      ok: false,
      error: "Hệ thống tra cứu khách sạn thật chưa được cấu hình. Hãy mời khách mở trang Khách sạn.",
      hotelsPageUrl: pageUrl,
    };
  }

  ctx.modes.add("liteapi");
  try {
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
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LiteAPI timeout (chat)")), 18000)),
    ]);

    const areaHotels = area ? hotels.filter((hotel) => hotelMatchesArea(hotel, area as DestinationArea)) : hotels;
    if (area && hotels.length > 0 && areaHotels.length === 0) {
      return {
        ok: true,
        count: 0,
        reason: "no_area_match",
        location: locationLabel,
        hotelsPageUrl: pageUrl,
        note: `Không có khách sạn khớp đúng khu ${area.label}. Gợi ý khách đổi khu vực hoặc bỏ ưu tiên khu vực.`,
      };
    }

    const matching = maxNightlyBudget
      ? areaHotels.filter((hotel) => hotel.price / nights <= (maxNightlyBudget as number))
      : areaHotels;

    if (matching.length === 0) {
      const cheapestNightly = areaHotels.length ? Math.min(...areaHotels.map((h) => h.price / nights)) : null;
      return {
        ok: true,
        count: 0,
        reason: maxNightlyBudget ? "over_budget" : "no_availability",
        location: locationLabel,
        checkIn,
        checkOut,
        guests,
        maxNightlyBudget,
        cheapestNightly: cheapestNightly ? Math.round(cheapestNightly) : null,
        hotelsPageUrl: pageUrl,
      };
    }

    const top = matching.slice(0, 4);
    const cards = await Promise.all(
      top.map(async (h) => ({
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
        facilities: h.facilities,
        boardName: h.boardName,
        refundable: h.refundable,
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
      }))
    );
    ctx.suggestedHotels = cards;

    return {
      ok: true,
      count: cards.length,
      location: locationLabel,
      checkIn,
      checkOut,
      nights,
      guests,
      maxNightlyBudget,
      hotelsPageUrl: pageUrl,
      // Thẻ khách sạn hiển thị riêng dưới giao diện; phần text chỉ cần tóm tắt.
      hotels: cards.map((c) => ({
        name: c.name,
        nightlyPrice: Math.round(c.price / nights),
        totalPrice: c.price,
        currency: c.currency,
        starRating: c.starRating,
        rating: c.rating,
        refundable: c.refundable,
        boardName: c.boardName,
      })),
      note: "Thẻ khách sạn đã được hiển thị cho khách. Viết câu dẫn ngắn gọn, không liệt kê lại toàn bộ.",
    };
  } catch (error) {
    console.error("find_hotels error:", error);
    return {
      ok: false,
      error: "Hệ thống tra cứu khách sạn phản hồi chậm/timeout. Mời khách mở trang Khách sạn để xem giá realtime.",
      hotelsPageUrl: pageUrl,
    };
  }
}

function runDestinationGuide(args: Record<string, unknown>): unknown {
  const cityRaw = typeof args.city === "string" ? args.city : "";
  const dest = cityRaw ? (detectDestination(cityRaw) as Destination | undefined) : undefined;
  if (!dest) {
    return {
      ok: false,
      error: `Mình chưa có dữ liệu cho "${cityRaw || "(trống)"}".`,
      supportedDestinations: DESTINATIONS.map((d) => d.label),
    };
  }
  const areas = areasForDestination(dest);
  let area: DestinationArea | null = null;
  if (typeof args.area === "string" && args.area.trim()) {
    const detected = detectDestinationArea(args.area) as DestinationArea | undefined;
    if (detected && detected.cityName === dest.cityName && detected.countryCode === dest.countryCode) {
      area = detected;
    }
  }
  const guide = area ? guideForArea(area) : guideForDestination(dest);
  return {
    ok: true,
    destination: dest.label,
    area: area?.label ?? null,
    reason: guide?.reason ?? null,
    highlights: guide?.highlights ?? [],
    availableAreas: areas.map((a) => a.label),
  };
}

function runResortKnowledge(args: Record<string, unknown>, ctx: ToolRunContext): unknown {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) return { ok: false, error: "Thiếu nội dung cần tra cứu." };
  const docs = retrieve(query, 5);
  // Gợi ý thẻ phòng cho các phòng xuất hiện trong tri thức truy xuất.
  const roomIds = docs
    .filter((d) => d.category === "room")
    .map((d) => d.id.replace(/^room-/, ""))
    .filter((id) => ROOMS.some((r) => r.id === id));
  ctx.suggestedRoomIds = Array.from(new Set([...ctx.suggestedRoomIds, ...roomIds])).slice(0, 3);
  return {
    ok: docs.length > 0,
    knowledge: contextBlock(docs),
    note: "Chỉ trả lời dựa trên 'knowledge' bên trên; thiếu dữ liệu thì nói cần kiểm tra lại, không bịa.",
  };
}

// Thực thi một lời gọi công cụ; luôn trả về CHUỖI JSON cho model.
export async function executeTool(name: string, rawArgs: string, ctx: ToolRunContext): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArgs || "{}");
    if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: "Tham số công cụ không phải JSON hợp lệ." });
  }
  try {
    if (name === "find_hotels") return JSON.stringify(await runFindHotels(args, ctx));
    if (name === "get_destination_guide") return JSON.stringify(runDestinationGuide(args));
    if (name === "search_resort_knowledge") return JSON.stringify(runResortKnowledge(args, ctx));
    return JSON.stringify({ ok: false, error: `Công cụ không tồn tại: ${name}` });
  } catch (error) {
    console.error(`tool ${name} error:`, error);
    return JSON.stringify({ ok: false, error: "Công cụ gặp lỗi nội bộ." });
  }
}
