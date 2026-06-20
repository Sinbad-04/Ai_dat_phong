// lib/data/knowledge.ts
// Cơ sở tri thức của khu nghỉ dưỡng. Đây là nguồn cho RAG (tra cứu) + seed phòng vào DB.
// Trong thực tế bạn có thể thay bằng dữ liệu kéo từ PMS/CMS của khách sạn.

export type Room = {
  id: string;
  name: string;
  type: string;
  capacity: number;       // số khách tối đa
  inventory: number;      // số phòng/villa có thể bán đồng thời
  beds: string;
  size: number;           // m2
  view: string;
  basePrice: number;      // VND / đêm (giá tham chiếu mùa thường)
  amenities: string[];
  image: string;          // emoji/biểu tượng minh hoạ (giữ nhẹ, không phụ thuộc IP)
  photo?: string;         // ảnh phòng dùng cho thẻ giao diện
  blurb: string;
};

export const RESORT = {
  name: "An Lành Bay Resort & Spa",
  location: "Bãi Dài, Cam Ranh, Khánh Hoà",
  checkIn: "14:00",
  checkOut: "12:00",
};

export const ROOMS: Room[] = [
  {
    id: "deluxe-garden",
    name: "Deluxe Garden View",
    type: "Deluxe",
    capacity: 2,
    inventory: 8,
    beds: "1 giường King hoặc 2 giường đơn",
    size: 38,
    view: "Vườn nhiệt đới",
    basePrice: 2200000,
    amenities: ["Ban công", "Máy lạnh", "Minibar", "Wifi tốc độ cao", "Bồn tắm"],
    image: "🌿",
    blurb: "Phòng ấm cúng nhìn ra vườn, hợp cặp đôi hoặc khách đi công tác muốn yên tĩnh.",
  },
  {
    id: "deluxe-ocean",
    name: "Deluxe Ocean View",
    type: "Deluxe",
    capacity: 2,
    inventory: 6,
    beds: "1 giường King",
    size: 42,
    view: "Hướng biển",
    basePrice: 3100000,
    amenities: ["Ban công hướng biển", "Máy lạnh", "Minibar", "Wifi", "Bồn tắm", "Máy pha cà phê"],
    image: "🌊",
    photo: "/images/rooms/deluxe-ocean-view.jpg",
    blurb: "View biển trực diện, đón bình minh ngay trên ban công. Best-seller cho cặp đôi.",
  },
  {
    id: "family-suite",
    name: "Family Suite 2 Phòng Ngủ",
    type: "Suite",
    capacity: 4,
    inventory: 4,
    beds: "1 King + 2 đơn",
    size: 75,
    view: "Hồ bơi & biển",
    basePrice: 5400000,
    amenities: ["2 phòng ngủ", "Phòng khách", "Bếp nhỏ", "2 nhà tắm", "Ban công lớn", "Khu vui chơi trẻ em gần kề"],
    image: "👨‍👩‍👧",
    photo: "/images/rooms/family-suite.jpg",
    blurb: "Không gian rộng cho gia đình có trẻ nhỏ, gần hồ bơi và khu trẻ em.",
  },
  {
    id: "honeymoon-villa",
    name: "Honeymoon Pool Villa",
    type: "Villa",
    capacity: 2,
    inventory: 3,
    beds: "1 King canopy",
    size: 110,
    view: "Biển riêng tư",
    basePrice: 9800000,
    amenities: ["Hồ bơi riêng", "Sân vườn riêng", "Bồn tắm ngoài trời", "Bữa sáng tại villa", "Lối đi biển riêng"],
    image: "💍",
    photo: "/images/rooms/honeymoon-pool-villa.jpg",
    blurb: "Villa biệt lập có hồ bơi riêng, lý tưởng cho tuần trăng mật và kỷ niệm.",
  },
  {
    id: "grand-villa",
    name: "Grand Beach Villa 3 Phòng Ngủ",
    type: "Villa",
    capacity: 6,
    inventory: 2,
    beds: "2 King + 2 đơn",
    size: 180,
    view: "Mặt tiền biển",
    basePrice: 15500000,
    amenities: ["Hồ bơi riêng lớn", "Đầu bếp riêng (theo yêu cầu)", "BBQ ngoài trời", "3 phòng ngủ", "Phòng gia đình"],
    image: "🏝️",
    blurb: "Lựa chọn cao cấp cho nhóm bạn hoặc đại gia đình, riêng tư tuyệt đối sát biển.",
  },
];

// Gói combo / trải nghiệm có thể đề xuất kèm
export const PACKAGES = [
  {
    id: "romance",
    name: "Gói Lãng Mạn 3N2Đ",
    forWho: "Cặp đôi, kỷ niệm, trăng mật",
    includes: ["2 đêm phòng Ocean/Villa", "Ăn sáng buffet", "1 bữa tối lãng mạn bên biển", "Spa đôi 60 phút", "Trang trí phòng hoa & nến"],
    fromPrice: 7900000,
  },
  {
    id: "family-fun",
    name: "Gói Gia Đình Vui Khoẻ 4N3Đ",
    forWho: "Gia đình có trẻ em",
    includes: ["3 đêm Family Suite", "Ăn sáng cho cả nhà", "Miễn phí 2 trẻ dưới 12 tuổi", "Vé khu vui chơi trẻ em", "1 tour đảo nửa ngày"],
    fromPrice: 14200000,
  },
  {
    id: "wellness",
    name: "Gói Tĩnh Dưỡng & Spa 3N2Đ",
    forWho: "Khách muốn nghỉ ngơi, phục hồi",
    includes: ["2 đêm Deluxe", "Ăn sáng healthy", "2 buổi yoga sáng", "2 liệu trình spa", "Set thực đơn detox"],
    fromPrice: 8600000,
  },
  {
    id: "workation",
    name: "Gói Workation 5N4Đ",
    forWho: "Người làm việc từ xa, đi công tác dài",
    includes: ["4 đêm Deluxe Garden", "Ăn sáng", "Wifi ưu tiên + bàn làm việc", "Cà phê không giới hạn", "Late check-out 15:00"],
    fromPrice: 9900000,
  },
];

// Ưu đãi theo mùa (RAG dùng để tư vấn thời điểm đặt)
export const SEASONAL = [
  {
    season: "Thấp điểm (T5–T8, trừ lễ)",
    promo: "Giảm 25% giá phòng + miễn phí nâng hạng phòng (tuỳ tình trạng trống).",
    note: "Thời điểm giá tốt nhất trong năm, ít đông.",
  },
  {
    season: "Cao điểm hè & lễ (30/4, 2/9)",
    promo: "Phụ thu cuối tuần ~15%; cần đặt sớm 3–4 tuần.",
    note: "Đông khách, gói gia đình bán nhanh.",
  },
  {
    season: "Mùa Tết Âm lịch",
    promo: "Gói trọn vẹn có tiệc tất niên & countdown, phụ thu lễ.",
    note: "Đặt trước tối thiểu 6 tuần.",
  },
  {
    season: "Tháng sinh nhật resort (T11)",
    promo: "Đặt 3 đêm tặng 1 đêm cho hạng Villa; tặng spa 30 phút.",
    note: "Số lượng phòng ưu đãi giới hạn.",
  },
];

// Chính sách — phần khách hỏi nhiều nhất (hủy, trẻ em, thú cưng...)
export const POLICIES = [
  {
    topic: "Chính sách huỷ phòng",
    detail:
      "Huỷ miễn phí trước 7 ngày so với ngày nhận phòng. Huỷ trong vòng 3–7 ngày: phí 50% đêm đầu. Huỷ trong 72 giờ hoặc no-show: phí 100% đêm đầu. Gói khuyến mãi đặc biệt có thể không hoàn huỷ — sẽ ghi rõ khi đặt.",
  },
  {
    topic: "Chính sách trẻ em",
    detail:
      "Trẻ dưới 6 tuổi: miễn phí khi ngủ chung giường với bố mẹ và dùng tiện ích sẵn có. Trẻ 6–11 tuổi: phụ thu 50% suất ăn sáng, miễn phí lưu trú nếu không cần thêm giường. Từ 12 tuổi tính như người lớn. Có nôi em bé miễn phí (báo trước), giường phụ phụ thu 350.000đ/đêm.",
  },
  {
    topic: "Chính sách thú cưng",
    detail:
      "Chấp nhận thú cưng nhỏ (dưới 8kg) tại hạng Villa có sân vườn riêng, phụ thu 300.000đ/đêm và cần báo trước. Không nhận thú cưng tại khu phòng Deluxe và khu hồ bơi chung, nhà hàng buffet vì lý do vệ sinh.",
  },
  {
    topic: "Giờ nhận / trả phòng",
    detail:
      "Nhận phòng từ 14:00, trả phòng trước 12:00. Early check-in / late check-out tuỳ tình trạng phòng trống, có thể phụ thu 50% giá đêm nếu quá 15:00.",
  },
  {
    topic: "Thanh toán & đặt cọc",
    detail:
      "Đặt phòng cần đặt cọc 30% để giữ chỗ, thanh toán phần còn lại khi nhận phòng. Khu nghỉ KHÔNG lưu trữ thông tin thẻ; khách tự nhập thanh toán trên cổng an toàn của ngân hàng. Xuất hoá đơn VAT theo yêu cầu.",
  },
  {
    topic: "Bữa sáng & ẩm thực",
    detail:
      "Buffet sáng 6:30–10:00 tại nhà hàng Biển Xanh. Có suất chay, suất cho trẻ em và lựa chọn healthy. Nhà hàng hải sản mở 17:30–22:00, nên đặt bàn trước với phòng villa.",
  },
  {
    topic: "Đưa đón & di chuyển",
    detail:
      "Cách sân bay Cam Ranh ~20 phút lái xe. Dịch vụ đưa đón sân bay 350.000đ/lượt/xe 4 chỗ, đặt trước 24 giờ. Có thuê xe đạp và xe điện trong khu nghỉ.",
  },
];

// Gộp toàn bộ tri thức thành các "đoạn" để RAG truy xuất.
export type Doc = { id: string; title: string; text: string; category: string };

export function buildKnowledgeDocs(): Doc[] {
  const docs: Doc[] = [];
  docs.push({
    id: "resort-info",
    title: "Thông tin chung khu nghỉ",
    category: "general",
    text: `${RESORT.name} tại ${RESORT.location}. Nhận phòng ${RESORT.checkIn}, trả phòng ${RESORT.checkOut}.`,
  });
  for (const r of ROOMS) {
    docs.push({
      id: `room-${r.id}`,
      title: `Phòng: ${r.name}`,
      category: "room",
      text: `${r.name} (${r.type}). Tối đa ${r.capacity} khách. Giường: ${r.beds}. Diện tích ${r.size}m². View ${r.view}. Giá tham chiếu ${r.basePrice.toLocaleString("vi-VN")}đ/đêm. Tiện ích: ${r.amenities.join(", ")}. ${r.blurb}`,
    });
  }
  for (const p of PACKAGES) {
    docs.push({
      id: `package-${p.id}`,
      title: `Gói: ${p.name}`,
      category: "package",
      text: `${p.name} — dành cho ${p.forWho}. Bao gồm: ${p.includes.join(", ")}. Giá từ ${p.fromPrice.toLocaleString("vi-VN")}đ.`,
    });
  }
  for (const s of SEASONAL) {
    docs.push({
      id: `season-${s.season}`,
      title: `Ưu đãi mùa: ${s.season}`,
      category: "seasonal",
      text: `${s.season}: ${s.promo} (${s.note})`,
    });
  }
  for (const p of POLICIES) {
    docs.push({
      id: `policy-${p.topic}`,
      title: p.topic,
      category: "policy",
      text: `${p.topic}: ${p.detail}`,
    });
  }
  return docs;
}
