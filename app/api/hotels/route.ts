import { NextResponse } from "next/server";
import { isConfigured, searchHotels } from "@/lib/liteapi";
import { RESORT, ROOMS } from "@/lib/data/knowledge";
import { findDestination } from "@/lib/data/destinations";
import { validateStayDates } from "@/lib/validation";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createOfferToken } from "@/lib/offer-token";

export const runtime = "nodejs";
export const maxDuration = 30;

// Fallback: coi An Lành Bay như một khách sạn với các hạng phòng tĩnh
function fallbackHotels(checkin: string, checkout: string, adults: number) {
  const n = validateStayDates(checkin, checkout).nights;
  return ROOMS.filter((r) => r.capacity >= adults).map((r) => ({
    hotelId: `static-${r.id}`,
    name: `${RESORT.name} — ${r.name}`,
    address: RESORT.location,
    city: "Cam Ranh",
    country: "VN",
    image: undefined as string | undefined,
    images: [] as string[],
    starRating: 5,
    rating: 9.2,
    reviewCount: 128,
    facilities: ["Hồ bơi vô cực", "WiFi miễn phí", "Bữa sáng buffet", "Spa", "Bãi biển riêng", "Đưa đón sân bay"],
    offerId: `static-${r.id}`,
    rateName: r.blurb,
    boardName: undefined as string | undefined,
    refundable: true,
    price: r.basePrice * n,
    currency: "VND",
    checkin,
    checkout,
  }));
}

export async function GET(req: Request) {
  const rate = checkRateLimit(req, { namespace: "hotel-search", limit: 60, windowMs: 60 * 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
  const { searchParams } = new URL(req.url);
  const dest = searchParams.get("dest") || "Nha Trang|VN";
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const rawAdults = Number(searchParams.get("adults") || 2);
  const adults = Number.isInteger(rawAdults) ? rawAdults : 0;

  if (!checkin || !checkout) {
    return NextResponse.json({ error: "Thiếu ngày nhận/trả phòng" }, { status: 400 });
  }
  const stay = validateStayDates(checkin, checkout);
  if (stay.error) return NextResponse.json({ error: stay.error }, { status: 400 });
  if (adults < 1 || adults > 9) return NextResponse.json({ error: "Số khách phải từ 1 đến 9" }, { status: 400 });

  if (!isConfigured()) {
    return NextResponse.json({
      source: "fallback",
      note: "Chưa cấu hình LITEAPI_API_KEY — đang hiển thị dữ liệu mẫu của An Lành Bay. Thêm key để bật dữ liệu khách sạn thật.",
      hotels: fallbackHotels(checkin, checkout, adults),
    });
  }

  const d = findDestination(dest);
  if (!d) return NextResponse.json({ error: "Điểm đến không hợp lệ" }, { status: 400 });

  try {
    const hotels = await searchHotels({
      cityName: d.cityName,
      countryCode: d.countryCode,
      checkin,
      checkout,
      adults,
    });
    const signedHotels = await Promise.all(hotels.map(async (hotel) => ({
      ...hotel,
      offerToken: await createOfferToken({
        offerId: hotel.offerId,
        hotelId: hotel.hotelId,
        name: hotel.name,
        roomDescription: hotel.rateName,
        checkIn: hotel.checkin,
        checkOut: hotel.checkout,
        guests: adults,
      }),
    })));
    return NextResponse.json({
      source: "liteapi",
      note:
        hotels.length === 0
          ? "Không tìm thấy phòng trống cho lựa chọn này. Thử đổi ngày hoặc điểm đến (Singapore/Bangkok/Paris nhiều dữ liệu sandbox hơn)."
          : undefined,
      hotels: signedHotels,
    });
  } catch (error) {
    console.error("LiteAPI hotel search failed:", error);
    return NextResponse.json({
      source: "fallback",
      note: "Dịch vụ khách sạn đang gián đoạn nên tạm dùng dữ liệu mẫu.",
      hotels: fallbackHotels(checkin, checkout, adults),
    });
  }
}
