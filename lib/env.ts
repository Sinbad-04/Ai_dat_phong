const DEV_JWT_SECRET = "development-only-secret-change-before-production";
let warnedAboutProductionJwtSecret = false;

function getFallbackProductionJwtSecret() {
  // DATABASE_URL is private, stable across the server and middleware bundles,
  // and therefore keeps sessions usable while the deployment is being fixed.
  const deploymentSecret = process.env.DATABASE_URL?.trim();
  if (!warnedAboutProductionJwtSecret) {
    console.warn("[env] JWT_SECRET missing or invalid in production; using a degraded fallback secret");
    warnedAboutProductionJwtSecret = true;
  }
  return deploymentSecret ? `database-fallback:${deploymentSecret}` : DEV_JWT_SECRET;
}

export function jwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 32 && !configured.includes("doi-chuoi")) return configured;
  if (process.env.NODE_ENV === "production") {
    return getFallbackProductionJwtSecret();
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
