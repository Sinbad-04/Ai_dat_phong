// lib/data/destinations.ts
// Điểm đến cho LiteAPI (search theo cityName + countryCode).
// Tên thành phố nên khớp danh sách của LiteAPI (/data/cities). Có thể bổ sung thêm.
export type Destination = { cityName: string; countryCode: string; label: string; intl?: boolean };
export type DestinationArea = {
  value: string;
  label: string;
  cityName: string;
  countryCode: string;
  keywords: string[];
};

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

export const DESTINATION_AREAS: DestinationArea[] = [
  { value: "ho-tay", label: "Hồ Tây", cityName: "Hanoi", countryCode: "VN", keywords: ["hồ tây", "ho tay", "tây hồ", "tay ho", "west lake"] },
  { value: "hoan-kiem", label: "Phố cổ · Hoàn Kiếm", cityName: "Hanoi", countryCode: "VN", keywords: ["hoàn kiếm", "hoan kiem", "phố cổ", "pho co", "old quarter"] },
  { value: "ba-dinh", label: "Ba Đình", cityName: "Hanoi", countryCode: "VN", keywords: ["ba đình", "ba dinh"] },
  { value: "cau-giay", label: "Cầu Giấy", cityName: "Hanoi", countryCode: "VN", keywords: ["cầu giấy", "cau giay"] },
  { value: "my-khe", label: "Biển Mỹ Khê", cityName: "Da Nang", countryCode: "VN", keywords: ["mỹ khê", "my khe"] },
  { value: "son-tra", label: "Sơn Trà", cityName: "Da Nang", countryCode: "VN", keywords: ["sơn trà", "son tra"] },
  { value: "ngu-hanh-son", label: "Ngũ Hành Sơn", cityName: "Da Nang", countryCode: "VN", keywords: ["ngũ hành sơn", "ngu hanh son"] },
  { value: "hai-chau", label: "Trung tâm Hải Châu", cityName: "Da Nang", countryCode: "VN", keywords: ["hải châu", "hai chau"] },
  { value: "tran-phu", label: "Đường Trần Phú", cityName: "Nha Trang", countryCode: "VN", keywords: ["trần phú", "tran phu"] },
  { value: "hon-chong", label: "Hòn Chồng", cityName: "Nha Trang", countryCode: "VN", keywords: ["hòn chồng", "hon chong"] },
  { value: "vinh-hai", label: "Vĩnh Hải", cityName: "Nha Trang", countryCode: "VN", keywords: ["vĩnh hải", "vinh hai"] },
  { value: "quan-1", label: "Quận 1", cityName: "Ho Chi Minh City", countryCode: "VN", keywords: ["quận 1", "quan 1", "district 1"] },
  { value: "thao-dien", label: "Thảo Điền", cityName: "Ho Chi Minh City", countryCode: "VN", keywords: ["thảo điền", "thao dien"] },
  { value: "phu-nhuan", label: "Phú Nhuận", cityName: "Ho Chi Minh City", countryCode: "VN", keywords: ["phú nhuận", "phu nhuan"] },
  { value: "duong-dong", label: "Dương Đông", cityName: "Phu Quoc", countryCode: "VN", keywords: ["dương đông", "duong dong"] },
  { value: "bai-truong", label: "Bãi Trường", cityName: "Phu Quoc", countryCode: "VN", keywords: ["bãi trường", "bai truong", "long beach"] },
  { value: "ong-lang", label: "Ông Lang", cityName: "Phu Quoc", countryCode: "VN", keywords: ["ông lang", "ong lang"] },
  { value: "ho-tuyen-lam", label: "Hồ Tuyền Lâm", cityName: "Da Lat", countryCode: "VN", keywords: ["hồ tuyền lâm", "ho tuyen lam", "tuyen lam"] },
  { value: "trung-tam-da-lat", label: "Trung tâm Đà Lạt", cityName: "Da Lat", countryCode: "VN", keywords: ["trung tâm đà lạt", "trung tam da lat", "chợ đà lạt", "da lat market"] },
];

export function findDestination(key: string): Destination | undefined {
  return DESTINATIONS.find((d) => `${d.cityName}|${d.countryCode}` === key);
}

export function areasForDestination(destination: Pick<Destination, "cityName" | "countryCode">): DestinationArea[] {
  return DESTINATION_AREAS.filter(
    (area) => area.cityName === destination.cityName && area.countryCode === destination.countryCode
  );
}

export function findDestinationArea(
  value: string,
  destination?: Pick<Destination, "cityName" | "countryCode">
): DestinationArea | undefined {
  return DESTINATION_AREAS.find(
    (area) => area.value === value && (!destination || (area.cityName === destination.cityName && area.countryCode === destination.countryCode))
  );
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

export function detectDestinationArea(text: string): DestinationArea | undefined {
  const value = norm(text);
  return DESTINATION_AREAS.find((area) => area.keywords.some((keyword) => value.includes(norm(keyword))));
}

export function hotelMatchesArea(
  hotel: { name?: string; address?: string; city?: string },
  area: DestinationArea
): boolean {
  const haystack = norm([hotel.name, hotel.address, hotel.city].filter(Boolean).join(" "));
  return area.keywords.some((keyword) => haystack.includes(norm(keyword)));
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
