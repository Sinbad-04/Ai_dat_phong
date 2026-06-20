import { NextResponse } from "next/server";
import { isConfigured, searchHotels } from "@/lib/liteapi";
import { RESORT, ROOMS } from "@/lib/data/knowledge";
import { findDestination } from "@/lib/data/destinations";

export const runtime = "nodejs";
export const maxDuration = 30;

function nights(a: string, b: string) {
  return Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86400000));
}

// Fallback: coi An Lành Bay như một khách sạn với các hạng phòng tĩnh
function fallbackHotels(checkin: string, checkout: string, adults: number) {
  const n = nights(checkin, checkout);
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
  const { searchParams } = new URL(req.url);
  const dest = searchParams.get("dest") || "Nha Trang|VN";
  const checkin = searchParams.get("checkin") || "";
  const checkout = searchParams.get("checkout") || "";
  const adults = Math.max(1, Math.min(9, Number(searchParams.get("adults") || 2)));

  if (!checkin || !checkout) {
    return NextResponse.json({ error: "Thiếu ngày nhận/trả phòng" }, { status: 400 });
  }
  if (nights(checkin, checkout) < 1) {
    return NextResponse.json({ error: "Ngày trả phòng phải sau ngày nhận phòng" }, { status: 400 });
  }

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
    return NextResponse.json({
      source: "liteapi",
      note:
        hotels.length === 0
          ? "Không tìm thấy phòng trống cho lựa chọn này. Thử đổi ngày hoặc điểm đến (Singapore/Bangkok/Paris nhiều dữ liệu sandbox hơn)."
          : undefined,
      hotels,
    });
  } catch (e: any) {
    return NextResponse.json({
      source: "fallback",
      note: "Gọi LiteAPI lỗi nên tạm dùng dữ liệu mẫu. Chi tiết: " + (e?.message || "unknown"),
      hotels: fallbackHotels(checkin, checkout, adults),
    });
  }
}
