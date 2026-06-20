// lib/pricecompare.ts
// So sánh giá đa nền tảng (metasearch nhẹ — mô hình trung gian).
//  • Giá "Chúng tôi" (LiteAPI) là THẬT và đặt được ngay tại web.
//  • Giá các nền tảng khác (Booking, Agoda, Traveloka, Google Hotels) hiện ở dạng
//    ƯỚC TÍNH minh hoạ, kèm link "Kiểm tra" mở đúng trang tìm kiếm THẬT của nền tảng đó
//    (theo tên khách sạn + ngày), để khách tự đối chiếu.
//  • Khi có TRAVELPAYOUTS_TOKEN (Travelpayouts gộp Booking/Agoda…), có thể thay phần
//    ước tính bằng giá thật — xem README mục so sánh giá.

export type CompareRow = {
  platform: string;
  price: number;
  currency: string;
  url: string; // link tìm kiếm thật trên nền tảng đó (rỗng với hàng của mình)
  estimated: boolean; // true = ước tính minh hoạ
  ours?: boolean; // hàng của mình (LiteAPI) — giá thật, đặt được
};

function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function buildComparison(input: {
  hotelName: string;
  city?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  ourPrice: number;
  currency: string;
}): CompareRow[] {
  const q = encodeURIComponent(`${input.hotelName}${input.city ? " " + input.city : ""}`);
  const ci = input.checkIn;
  const co = input.checkOut;
  const ad = input.guests;

  const urls: Record<string, string> = {
    "Booking.com": `https://www.booking.com/searchresults.vi.html?ss=${q}&checkin=${ci}&checkout=${co}&group_adults=${ad}`,
    Agoda: `https://www.agoda.com/search?q=${q}&checkIn=${ci}&checkOut=${co}&adults=${ad}`,
    Traveloka: `https://www.traveloka.com/vi-VN/hotel?q=${q}`,
    "Google Hotels": `https://www.google.com/travel/search?q=${q}`,
  };

  const base = input.ourPrice;
  const h = seed(input.hotelName || "x");
  // Mỗi nền tảng có độ lệch cố định theo tên khách sạn (ổn định giữa các lần mở).
  // Giá sỉ (LiteAPI) thường thấp hơn giá bán lẻ OTA -> ước tính lệch +1%..+9%.
  const offsets: Record<string, number> = {
    "Booking.com": 1 + ((h % 6) + 2) / 100, // +2%..+7%
    Agoda: 1 + (((h >> 3) % 6) + 1) / 100, // +1%..+6%
    Traveloka: 1 + (((h >> 6) % 7) + 3) / 100, // +3%..+9%
    "Google Hotels": 1 + (((h >> 9) % 5) + 2) / 100, // +2%..+6%
  };

  const rows: CompareRow[] = [
    { platform: "Chúng tôi (LiteAPI)", price: base, currency: input.currency, url: "", estimated: false, ours: true },
    ...Object.keys(urls).map((p) => ({
      platform: p,
      price: Math.round((base * offsets[p]) / 1000) * 1000,
      currency: input.currency,
      url: urls[p],
      estimated: true,
    })),
  ];
  return rows;
}
