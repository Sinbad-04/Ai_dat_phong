export function vnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}
export function money(n: number, currency = "VND"): string {
  if (currency === "VND") return vnd(n);
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(n);
  } catch {
    return `${new Intl.NumberFormat("vi-VN").format(Math.round(n))} ${currency}`;
  }
}
export function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return s;
  }
}
