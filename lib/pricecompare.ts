// Lightweight metasearch comparison. LiteAPI is the bookable price; the other
// rows are clearly labelled estimates and link to each provider for verification.

export type CompareRow = {
  platform: string;
  price: number | null;
  currency: string;
  url: string;
  estimated: boolean;
  ours?: boolean;
};

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
      price: null,
      currency: input.currency,
      url: urls[platform],
      estimated: false,
    })),
  ];
}
