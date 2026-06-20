export const MAX_STAY_NIGHTS = 30;

function dateOnlyToUtc(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return time;
}

export function todayYmd(timeZone = process.env.APP_TIME_ZONE || "Asia/Ho_Chi_Minh"): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function validateStayDates(
  checkIn: string,
  checkOut: string,
  options: { allowPast?: boolean; maxNights?: number } = {}
): { nights: number; error?: string } {
  const start = dateOnlyToUtc(checkIn);
  const end = dateOnlyToUtc(checkOut);
  if (start === null || end === null) return { nights: 0, error: "Ngày nhận/trả phòng không hợp lệ" };

  const nights = Math.round((end - start) / 86_400_000);
  if (nights < 1) return { nights: 0, error: "Ngày trả phòng phải sau ngày nhận phòng" };
  const maxNights = options.maxNights ?? MAX_STAY_NIGHTS;
  if (nights > maxNights) return { nights, error: `Mỗi lần đặt tối đa ${maxNights} đêm` };
  if (!options.allowPast && checkIn < todayYmd()) {
    return { nights, error: "Ngày nhận phòng không được ở trong quá khứ" };
  }
  return { nights };
}

