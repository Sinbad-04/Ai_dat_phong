// lib/data/destinations.ts
// Điểm đến cho LiteAPI (search theo cityName + countryCode).
// Tên thành phố nên khớp danh sách của LiteAPI (/data/cities). Có thể bổ sung thêm.
export type Destination = { cityName: string; countryCode: string; label: string; intl?: boolean };

export const DESTINATIONS: Destination[] = [
  // Việt Nam
  { cityName: "Nha Trang", countryCode: "VN", label: "Nha Trang" },
  { cityName: "Da Nang", countryCode: "VN", label: "Đà Nẵng" },
  { cityName: "Ho Chi Minh City", countryCode: "VN", label: "TP. Hồ Chí Minh" },
  { cityName: "Hanoi", countryCode: "VN", label: "Hà Nội" },
  { cityName: "Phu Quoc", countryCode: "VN", label: "Phú Quốc" },
  { cityName: "Da Lat", countryCode: "VN", label: "Đà Lạt" },
  // Quốc tế (sandbox LiteAPI nhiều dữ liệu ở các thành phố lớn)
  { cityName: "Singapore", countryCode: "SG", label: "Singapore", intl: true },
  { cityName: "Bangkok", countryCode: "TH", label: "Bangkok", intl: true },
  { cityName: "Paris", countryCode: "FR", label: "Paris", intl: true },
  { cityName: "London", countryCode: "GB", label: "London", intl: true },
  { cityName: "Tokyo", countryCode: "JP", label: "Tokyo", intl: true },
];

export function findDestination(key: string): Destination | undefined {
  return DESTINATIONS.find((d) => `${d.cityName}|${d.countryCode}` === key);
}

// Bỏ dấu tiếng Việt để khớp linh hoạt (vd "Hà Nội" ~ "ha noi").
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Một số cách gọi khác hay gặp -> điểm đến chuẩn.
const ALIASES: { keys: string[]; cityName: string; countryCode: string }[] = [
  { keys: ["saigon", "sai gon", "tphcm", "tp hcm", "ho chi minh"], cityName: "Ho Chi Minh City", countryCode: "VN" },
  { keys: ["ha noi", "hanoi", "ho tay", "thu do"], cityName: "Hanoi", countryCode: "VN" },
  { keys: ["danang", "da nang", "ngu hanh son", "my khe"], cityName: "Da Nang", countryCode: "VN" },
];

// Nhận diện điểm đến từ câu hỏi tự do của khách (tiếng Việt có/không dấu).
export function detectDestination(text: string): Destination | undefined {
  const t = norm(text);
  for (const a of ALIASES) {
    if (a.keys.some((k) => t.includes(norm(k)))) {
      const d = DESTINATIONS.find((x) => x.cityName === a.cityName && x.countryCode === a.countryCode);
      if (d) return d;
    }
  }
  for (const d of DESTINATIONS) {
    if (t.includes(norm(d.label)) || t.includes(norm(d.cityName))) return d;
  }
  return undefined;
}
