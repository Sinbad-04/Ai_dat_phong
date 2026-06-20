import { validateStayDates } from "./validation";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function parseMaxNightlyBudget(text: string): number | null {
  const match = normalize(text).match(
    /(?:<=|<|duoi|toi da|khong qua|nho hon)\s*(\d+(?:[.,]\d+)?)\s*(trieu|tr|nghin|ngan|k|vnd|d)?\b/i
  );
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2] || "";
  if (unit === "trieu" || unit === "tr") return Math.round(value * 1_000_000);
  if (["nghin", "ngan", "k"].includes(unit)) return Math.round(value * 1_000);
  if (unit === "vnd" || unit === "d" || value >= 10_000) return Math.round(value);
  return null;
}

export function parseGuests(text: string): number | null {
  const match = normalize(text).match(/\b(\d{1,2})\s*(?:khach|nguoi|nguoi lon|adults?)\b/);
  if (!match) return null;
  const guests = Number(match[1]);
  return guests >= 1 && guests <= 9 ? guests : null;
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseStayDates(text: string, now = new Date()): { checkIn: string; checkOut: string } | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\D+(20\d{2}-\d{2}-\d{2})\b/);
  if (iso && !validateStayDates(iso[1], iso[2]).error) return { checkIn: iso[1], checkOut: iso[2] };

  const matches = Array.from(text.matchAll(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/g));
  if (matches.length < 2) return null;
  let year = Number(matches[0][3] || matches[1][3] || now.getFullYear());
  let checkIn = ymd(year, Number(matches[0][2]), Number(matches[0][1]));
  let checkOut = ymd(Number(matches[1][3] || year), Number(matches[1][2]), Number(matches[1][1]));
  if (checkIn < ymd(now.getFullYear(), now.getMonth() + 1, now.getDate()) && !matches[0][3]) {
    year += 1;
    checkIn = ymd(year, Number(matches[0][2]), Number(matches[0][1]));
    checkOut = ymd(year, Number(matches[1][2]), Number(matches[1][1]));
  }
  return validateStayDates(checkIn, checkOut).error ? null : { checkIn, checkOut };
}

