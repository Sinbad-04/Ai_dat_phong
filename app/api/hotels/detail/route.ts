import { NextResponse } from "next/server";
import { isConfigured, getHotelContent } from "@/lib/liteapi";
import { translateToVietnamese } from "@/lib/llm";
import { RESORT, ROOMS } from "@/lib/data/knowledge";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hotelId = searchParams.get("hotelId") || "";
  if (!hotelId) return NextResponse.json({ error: "Thiếu hotelId" }, { status: 400 });

  // Dữ liệu mẫu (An Lành Bay) khi là offer fallback hoặc chưa cấu hình LiteAPI
  if (hotelId.startsWith("static-") || !isConfigured()) {
    const room = ROOMS.find((r) => r.id === hotelId.replace("static-", ""));
    return NextResponse.json({
      content: {
        name: room ? `${RESORT.name} — ${room.name}` : RESORT.name,
        address: RESORT.location,
        city: "Cam Ranh",
        country: "VN",
        image: undefined,
        images: [],
        starRating: 5,
        rating: 9.2,
        reviewCount: 128,
        facilities: [
          "Hồ bơi vô cực", "WiFi miễn phí", "Bữa sáng buffet", "Spa & xông hơi",
          "Bãi biển riêng", "Đưa đón sân bay", "Nhà hàng & bar", "Phòng gym",
        ],
        description: room?.blurb || "Khu nghỉ dưỡng ven biển với hồ bơi vô cực, spa và bãi biển riêng.",
        latitude: 11.9214,
        longitude: 109.2206,
      },
    });
  }

  try {
    const content = await getHotelContent(hotelId);
    // Mô tả từ LiteAPI là tiếng Anh -> dịch sang tiếng Việt và lọc nội dung code/prompt bất thường.
    const description = await translateToVietnamese(content.description, content.name);
    return NextResponse.json(
      { content: { ...content, description } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi lấy chi tiết khách sạn" }, { status: 502 });
  }
}
