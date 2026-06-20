const DEV_JWT_SECRET = "development-only-secret-change-before-production";

export function jwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 32 && !configured.includes("doi-chuoi")) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET production phải là chuỗi ngẫu nhiên tối thiểu 32 ký tự");
  }
  return DEV_JWT_SECRET;
}

export function adminConfig(): { email: string; password: string } {
  const email = (process.env.ADMIN_EMAIL || "admin@resort.vn").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (process.env.NODE_ENV === "production" && (!password || password === "Admin@12345" || password.length < 12)) {
    throw new Error("ADMIN_PASSWORD production phải được cấu hình và có tối thiểu 12 ký tự");
  }
  return { email, password: password || "Admin@12345" };
}

