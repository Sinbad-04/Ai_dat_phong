import { validateStayDates } from "./validation";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export function isGreetingOnly(text: string): boolean {
  const value = normalize(text).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(hi|hello|hey|alo|chao|chao ban|xin chao|xin chao ban)$/.test(value);
}

export function declinesAreaPreference(text: string): boolean {
  const value = normalize(text);
  return ["khong uu tien khu vuc", "khu nao cung duoc", "bat ky khu nao", "bo qua khu vuc"].some((item) => value.includes(item));
}

export function declinesBudgetFilter(text: string): boolean {
  const value = normalize(text);
  return ["khong gioi han ngan sach", "xem tat ca muc gia", "bo qua ngan sach", "chua co ngan sach"].some((item) => value.includes(item));
}

export function asksAboutDestinationHighlights(text: string): boolean {
  const value = normalize(text);
  return [
    "o day co gi",
    "co gi dep",
    "co gi hay",
    "co gi choi",
    "di dau choi",
    "tai sao nen den",
    "co gi thu vi",
  ].some((intent) => value.includes(intent));
}

export function wantsDifferentArea(text: string): boolean {
  const value = normalize(text);
  return ["cho khac", "khu khac", "dia diem khac", "doi khu vuc"].some((intent) => value.includes(intent));
}

export function hasExplicitTripPurpose(text: string): boolean {
  const value = normalize(text);
  return [
    "nghi duong",
    "trang mat",
    "honeymoon",
    "gia dinh",
    "cong tac",
    "kham pha",
    "city tour",
    "du lich bien",
    "du lich nui",
  ].some((purpose) => value.includes(purpose));
}

export function asksForRoomRecommendation(text: string): boolean {
  const value = normalize(text);
  return [
    "goi y phong",
    "tu van phong",
    "phong nao",
    "chon phong",
    "dat phong",
    "hang phong",
  ].some((intent) => value.includes(intent));
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

  const compact = normalize(text).match(/\b(\d{1,2})\s*(?:-|–|—|den|toi)\s*(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (compact) {
    let year = Number(compact[4] || now.getFullYear());
    let checkIn = ymd(year, Number(compact[3]), Number(compact[1]));
    let checkOut = ymd(year, Number(compact[3]), Number(compact[2]));
    if (checkIn < ymd(now.getFullYear(), now.getMonth() + 1, now.getDate()) && !compact[4]) {
      year += 1;
      checkIn = ymd(year, Number(compact[3]), Number(compact[1]));
      checkOut = ymd(year, Number(compact[3]), Number(compact[2]));
    }
    if (!validateStayDates(checkIn, checkOut).error) return { checkIn, checkOut };
  }

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
