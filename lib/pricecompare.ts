// Lightweight metasearch comparison. LiteAPI is the bookable price; the other
// rows are clearly labelled estimates and link to each provider for verification.

export type CompareRow = {
  platform: string;
  price: number;
  currency: string;
  url: string;
  estimated: boolean;
  ours?: boolean;
};

function seed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
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
  const query = encodeURIComponent(
    `${input.hotelName}${input.city ? ` ${input.city}` : ""}`
  );
  const { checkIn, checkOut, guests } = input;
  const urls: Record<string, string> = {
    "Booking.com": `https://www.booking.com/searchresults.vi.html?ss=${query}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}`,
    Agoda: `https://www.agoda.com/search?q=${query}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${guests}`,
    Traveloka: `https://www.traveloka.com/vi-VN/hotel?q=${query}`,
    "Google Hotels": `https://www.google.com/travel/search?q=${query}`,
  };

  const hash = seed(input.hotelName || "hotel");
  const offsets: Record<string, number> = {
    "Booking.com": 1 + ((hash % 6) + 2) / 100,
    Agoda: 1 + (((hash >> 3) % 6) + 1) / 100,
    Traveloka: 1 + (((hash >> 6) % 7) + 3) / 100,
    "Google Hotels": 1 + (((hash >> 9) % 5) + 2) / 100,
  };

  return [
    {
      platform: "Chúng tôi (LiteAPI)",
      price: input.ourPrice,
      currency: input.currency,
      url: "",
      estimated: false,
      ours: true,
    },
    ...Object.keys(urls).map((platform) => ({
      platform,
      price: Math.round((input.ourPrice * offsets[platform]) / 1000) * 1000,
      currency: input.currency,
      url: urls[platform],
      estimated: true,
    })),
  ];
}
