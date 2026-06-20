// lib/data/hotel-videos.ts
// Video giới thiệu (MP4) tuỳ chọn. LiteAPI KHÔNG cung cấp video — nếu bạn có video
// riêng (tự quay / host trên Cloudflare R2, Cloudinary, S3...), khai báo ở đây.
// Không khai báo -> card tự dùng slideshow ảnh thật khi hover.
//
// Dùng MP4 trực tiếp (autoplay-on-hover mượt). YouTube nhúng được nhưng kém mượt cho hover.

// Map theo hotelId của LiteAPI (chính xác nhất)
export const HOTEL_VIDEOS: Record<string, string> = {
  // "lp3803c": "https://cdn.cua-ban.com/hotels/lp3803c.mp4",
};

// Map theo thành phố (dùng chung cho mọi khách sạn trong thành phố đó)
export const CITY_VIDEOS: Record<string, string> = {
  // "Nha Trang": "https://cdn.cua-ban.com/destinations/nha-trang.mp4",
  // "Singapore": "https://cdn.cua-ban.com/destinations/singapore.mp4",
};

export function videoFor(hotelId?: string, city?: string): string | undefined {
  if (hotelId && HOTEL_VIDEOS[hotelId]) return HOTEL_VIDEOS[hotelId];
  if (city && CITY_VIDEOS[city]) return CITY_VIDEOS[city];
  return undefined;
}
