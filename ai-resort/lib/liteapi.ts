// lib/liteapi.ts
// Tích hợp LiteAPI — dữ liệu khách sạn thật + đặt phòng + thanh toán hosted.
// Luồng: rates (search) -> /data/hotel (làm giàu nội dung) -> prebook -> Payment SDK -> book.
// QUAN TRỌNG: thẻ nhập trên cổng Payment SDK của LiteAPI, server của mình KHÔNG chạm dữ liệu thẻ.

const SEARCH_BASE = process.env.LITEAPI_SEARCH_BASE || "https://api.liteapi.travel/v3.0";
const BOOK_BASE = process.env.LITEAPI_BOOK_BASE || "https://book.liteapi.travel/v2.0";

export function isConfigured(): boolean {
  return !!process.env.LITEAPI_API_KEY;
}

export function sdkPublicKey(): "sandbox" | "live" {
  return (process.env.LITEAPI_ENV || "sandbox").toLowerCase() === "production" ? "live" : "sandbox";
}

function headers() {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "X-API-Key": process.env.LITEAPI_API_KEY as string,
  };
}

// fetch có giới hạn thời gian — tránh treo khi LiteAPI sandbox chậm.
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Dịch tên tiện ích/phúc lợi từ LiteAPI (tiếng Anh) sang tiếng Việt.
// Khớp không phân biệt hoa/thường; cụm chưa có trong từ điển giữ nguyên bản gốc.
const FACILITY_VI: Record<string, string> = {
  // Internet & WiFi
  "free wifi": "WiFi miễn phí",
  "wifi": "WiFi",
  "wifi available in all areas": "WiFi ở mọi khu vực",
  "free wired internet": "Internet có dây miễn phí",
  "wired internet": "Internet có dây",
  "internet services": "Dịch vụ internet",
  // Đỗ xe
  "free parking": "Đỗ xe miễn phí",
  "parking": "Bãi đỗ xe",
  "private parking": "Bãi đỗ xe riêng",
  "valet parking": "Đỗ xe có người phục vụ",
  // Hồ bơi
  "swimming pool": "Hồ bơi",
  "outdoor pool": "Hồ bơi ngoài trời",
  "indoor pool": "Hồ bơi trong nhà",
  "infinity pool": "Hồ bơi vô cực",
  "private pool": "Hồ bơi riêng",
  "rooftop pool": "Hồ bơi trên sân thượng",
  // Spa & gym & wellness
  "spa": "Spa",
  "spa and wellness centre": "Trung tâm spa & chăm sóc sức khoẻ",
  "health or beauty spa nearby": "Spa sức khoẻ/làm đẹp gần đó",
  "massage": "Mát-xa",
  "fitness centre": "Phòng tập gym",
  "fitness center": "Phòng tập gym",
  "gym": "Phòng tập gym",
  "sauna": "Phòng xông hơi",
  "hot tub": "Bồn tắm nước nóng",
  "steam room": "Phòng xông hơi ướt",
  // Ăn uống
  "restaurant": "Nhà hàng",
  "bar": "Quầy bar",
  "breakfast": "Bữa sáng",
  "free breakfast": "Bữa sáng miễn phí",
  "buffet breakfast": "Bữa sáng buffet",
  "breakfast in the room": "Phục vụ bữa sáng tại phòng",
  "snack bar": "Quầy ăn nhẹ",
  "coffee shop": "Quán cà phê",
  "room service": "Phục vụ tại phòng",
  // Đưa đón
  "airport shuttle": "Đưa đón sân bay",
  "free airport shuttle": "Đưa đón sân bay miễn phí",
  "airport transportation": "Đưa đón sân bay",
  "airport transportation - pickup": "Đưa đón sân bay – đón",
  "airport transportation - drop-off": "Đưa đón sân bay – tiễn",
  "shuttle service": "Dịch vụ đưa đón",
  "car rental": "Cho thuê xe",
  // Lễ tân & dịch vụ
  "front desk": "Lễ tân",
  "24-hour front desk": "Lễ tân 24 giờ",
  "24 hour front desk": "Lễ tân 24 giờ",
  "express check-in": "Nhận phòng nhanh",
  "express check-out": "Trả phòng nhanh",
  "express check-in/check-out": "Nhận/trả phòng nhanh",
  "concierge": "Concierge (hỗ trợ khách)",
  "concierge service": "Dịch vụ concierge",
  "luggage storage": "Giữ hành lý",
  "currency exchange": "Đổi ngoại tệ",
  "tour desk": "Quầy hỗ trợ tour",
  "ticket service": "Dịch vụ đặt vé",
  "laundry": "Giặt là",
  "laundry service": "Dịch vụ giặt là",
  "dry cleaning": "Giặt khô",
  "daily housekeeping": "Dọn phòng hằng ngày",
  // Phòng & tiện nghi
  "air conditioning": "Máy lạnh",
  "heating": "Sưởi ấm",
  "non-smoking rooms": "Phòng không hút thuốc",
  "family rooms": "Phòng gia đình",
  "soundproof rooms": "Phòng cách âm",
  "minibar": "Minibar",
  "tea/coffee maker": "Máy pha trà/cà phê",
  "safety deposit box": "Két an toàn",
  "television in common areas": "TV ở khu vực chung",
  "flat-screen tv": "TV màn hình phẳng",
  // Khu vực chung & ngoài trời
  "elevator": "Thang máy",
  "lift": "Thang máy",
  "garden": "Sân vườn",
  "terrace": "Sân hiên",
  "rooftop terrace": "Sân thượng",
  "sun terrace": "Sân tắm nắng",
  "bbq facilities": "Khu BBQ",
  // Biển
  "private beach": "Bãi biển riêng",
  "private beach area": "Bãi biển riêng",
  "beachfront": "Sát biển",
  // Gia đình & giải trí
  "kids club": "Câu lạc bộ trẻ em",
  "children's playground": "Khu vui chơi trẻ em",
  "babysitting": "Giữ trẻ",
  "pets allowed": "Cho phép thú cưng",
  // Doanh nhân & họp
  "meeting rooms": "Phòng họp",
  "meeting/banquet facilities": "Phòng họp/tiệc",
  "business centre": "Trung tâm thương mại",
  // Tiếp cận
  "wheelchair accessible": "Lối đi cho xe lăn",
  "facilities for disabled guests": "Tiện nghi cho người khuyết tật",
  "non-smoking throughout": "Không hút thuốc toàn bộ",
  // Khác hay gặp
  "lift / elevator": "Thang máy",
  "internet access": "Truy cập internet",
  "fitness facilities": "Tiện ích thể hình",
  "housekeeping on request": "Dọn phòng theo yêu cầu",
  "beach umbrellas": "Ô/dù bãi biển",
  "guest education on local ecosystems and culture": "Giới thiệu hệ sinh thái & văn hoá địa phương",
  "outdoor furniture": "Bàn ghế ngoài trời",
  "designated smoking area": "Khu vực hút thuốc riêng",
};

// Ghi chú trong ngoặc hay gặp (vd "(surcharge)") -> tiếng Việt
const FACILITY_NOTE_VI: Record<string, string> = {
  "surcharge": "phụ phí",
  "additional charge": "phụ phí",
  "extra charge": "phụ phí",
  "free": "miễn phí",
  "on request": "theo yêu cầu",
  "limited hours": "giờ giới hạn",
  "seasonal": "theo mùa",
};

export function translateFacilities(items: string[]): string[] {
  return items.map((raw) => {
    const s = String(raw).trim();
    const key = s.toLowerCase();
    if (FACILITY_VI[key]) return FACILITY_VI[key];

    // Tách ghi chú trong ngoặc cuối câu, vd "Air conditioning (surcharge)"
    const m = key.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m) {
      const base = m[1].trim();
      const note = m[2].trim();
      const baseVi = FACILITY_VI[base] || m[1].trim();
      const noteVi = FACILITY_NOTE_VI[note] || note;
      return `${baseVi} (${noteVi})`;
    }
    return s; // chưa có trong từ điển -> giữ nguyên bản gốc
  });
}

export type LiveHotel = {
  hotelId: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string; // ảnh chính
  images?: string[]; // vài ảnh
  starRating?: number; // hạng sao (cơ sở vật chất)
  rating?: number; // điểm đánh giá của khách
  reviewCount?: number;
  facilities?: string[]; // tiện ích / phúc lợi
  offerId: string;
  rateName: string;
  boardName?: string;
  refundable?: boolean;
  price: number; // tổng kỳ lưu trú
  currency: string;
  checkin: string;
  checkout: string;
};

// ---- Cache nội dung khách sạn (tĩnh, dùng lại giữa các lần search) ----
type HotelContent = {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  image?: string;
  images?: string[];
  starRating?: number;
  rating?: number;
  reviewCount?: number;
  facilities?: string[];
  description?: string;
  latitude?: number;
  longitude?: number;
};
const contentCache = new Map<string, HotelContent>();

export async function getHotelContent(hotelId: string): Promise<HotelContent> {
  if (contentCache.has(hotelId)) return contentCache.get(hotelId) as HotelContent;
  try {
    const res = await fetchWithTimeout(
      `${SEARCH_BASE}/data/hotel?hotelId=${encodeURIComponent(hotelId)}`,
      { headers: headers() },
      8000
    );
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const d = j.data || {};
    const imgs: string[] = (d.hotelImages || [])
      .slice()
      .sort(
        (a: any, b: any) =>
          (b.defaultImage ? 1 : 0) - (a.defaultImage ? 1 : 0) ||
          (a.order || 0) - (b.order || 0)
      )
      .map((im: any) => im.url)
      .filter(Boolean);
    const rawFacilities: string[] | undefined = Array.isArray(d.hotelFacilities)
      ? d.hotelFacilities.slice(0, 10)
      : Array.isArray(d.facilities)
      ? d.facilities.map((f: any) => f.name).slice(0, 10)
      : undefined;
    const facilities = rawFacilities ? translateFacilities(rawFacilities) : undefined;
    const content: HotelContent = {
      name: d.name,
      address: d.address,
      city: d.city,
      country: d.country,
      image: imgs[0],
      images: imgs.slice(0, 6),
      starRating: d.starRating,
      rating: d.rating,
      reviewCount: d.reviewCount,
      facilities,
      description: d.hotelDescription,
      latitude: d.location?.latitude,
      longitude: d.location?.longitude,
    };
    contentCache.set(hotelId, content);
    return content;
  } catch {
    return {};
  }
}

// SEARCH: POST /hotels/rates -> offers (giá), rồi làm giàu nội dung qua /data/hotel
export async function searchHotels(input: {
  cityName: string;
  countryCode: string;
  checkin: string;
  checkout: string;
  adults: number;
  currency?: string;
  guestNationality?: string;
  limit?: number; // số khách sạn LiteAPI trả về (mặc định 30)
  enrich?: number; // số khách sạn làm giàu nội dung (mặc định 15)
}): Promise<LiveHotel[]> {
  const body = {
    cityName: input.cityName,
    countryCode: input.countryCode,
    checkin: input.checkin,
    checkout: input.checkout,
    currency: input.currency || "VND",
    guestNationality: input.guestNationality || "VN",
    occupancies: [{ adults: input.adults }],
    limit: input.limit ?? 30,
  };
  const res = await fetchWithTimeout(
    `${SEARCH_BASE}/hotels/rates`,
    { method: "POST", headers: headers(), body: JSON.stringify(body) },
    15000
  );
  if (!res.ok) throw new Error(`LiteAPI rates ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const data: any[] = json.data || [];

  // Lấy offer rẻ nhất cho mỗi khách sạn
  type Prelim = Omit<
    LiveHotel,
    "name" | "address" | "city" | "country" | "image" | "images" | "starRating" | "rating" | "reviewCount" | "facilities"
  >;
  const prelim: Prelim[] = [];
  for (const item of data) {
    const hotelId = item.hotelId;
    if (!hotelId) continue;
    let best: any = null;
    let bestPrice = Infinity;
    for (const rt of item.roomTypes || []) {
      const offerId = rt.offerId;
      const p = Number(
        rt.offerRetailRate?.amount ??
          rt.rates?.[0]?.retailRate?.total?.[0]?.amount ??
          Infinity
      );
      if (offerId && Number.isFinite(p) && p < bestPrice) {
        bestPrice = p;
        best = {
          offerId,
          rateName: rt.rates?.[0]?.name || "Phòng",
          boardName: rt.rates?.[0]?.boardName,
          refundable: rt.rates?.[0]?.cancellationPolicies?.refundableTag === "RFN",
          currency:
            rt.offerRetailRate?.currency ||
            rt.rates?.[0]?.retailRate?.total?.[0]?.currency ||
            input.currency ||
            "VND",
        };
      }
    }
    if (!best || !Number.isFinite(bestPrice)) continue;
    prelim.push({
      hotelId,
      offerId: best.offerId,
      rateName: best.rateName,
      boardName: best.boardName,
      refundable: best.refundable,
      price: Math.round(bestPrice),
      currency: best.currency,
      checkin: input.checkin,
      checkout: input.checkout,
    });
  }

  prelim.sort((a, b) => a.price - b.price);
  const top = prelim.slice(0, input.enrich ?? 15);

  // Làm giàu nội dung song song (có cache) — tên, ảnh, địa chỉ, sao, tiện ích
  const enriched = await Promise.all(
    top.map(async (h): Promise<LiveHotel> => {
      const c = await getHotelContent(h.hotelId);
      return {
        ...h,
        name: c.name || "Khách sạn",
        address: c.address,
        city: c.city,
        country: c.country,
        image: c.image,
        images: c.images,
        starRating: c.starRating,
        rating: c.rating,
        reviewCount: c.reviewCount,
        facilities: c.facilities,
      };
    })
  );
  return enriched;
}

// PREBOOK
export async function prebook(offerId: string): Promise<{
  prebookId: string;
  transactionId: string;
  secretKey: string;
  price: number;
  currency: string;
}> {
  const res = await fetch(`${BOOK_BASE}/rates/prebook`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ offerId, usePaymentSdk: true }),
  });
  if (!res.ok) throw new Error(`LiteAPI prebook ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const d = json.data || json;
  return {
    prebookId: d.prebookId || d.prebookID,
    transactionId: d.transactionId,
    secretKey: d.secretKey,
    price: Math.round(Number(d.price ?? d.offerRetailRate?.amount ?? 0)),
    currency: d.currency || d.offerRetailRate?.currency || "VND",
  };
}

// BOOK (TRANSACTION_ID — thẻ đã thu qua Payment SDK)
export async function book(input: {
  prebookId: string;
  transactionId: string;
  holder: { firstName: string; lastName: string; email: string };
}): Promise<{ bookingId: string; confirmationCode?: string; status?: string; raw: any }> {
  const res = await fetch(`${BOOK_BASE}/rates/book`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      prebookId: input.prebookId,
      holder: input.holder,
      payment: { method: "TRANSACTION_ID", transactionId: input.transactionId },
      guests: [
        {
          occupancyNumber: 1,
          firstName: input.holder.firstName,
          lastName: input.holder.lastName,
          email: input.holder.email,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LiteAPI book ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const d = json.data || json;
  return {
    bookingId: d.bookingId || d.bookingID || "",
    confirmationCode: d.hotelConfirmationCode || d.supplierBookingId,
    status: d.status,
    raw: d,
  };
}
